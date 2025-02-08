import torch
import numpy as np
from typing import Dict, Tuple, Union

class TensorDiff:
    @staticmethod
    def compute_diff(old_tensor: torch.Tensor, new_tensor: torch.Tensor, threshold: float = 1e-6) -> Dict[str, Union[str, np.ndarray, Tuple]]:
        """
        Compute the difference between two tensors.
        
        Args:
            old_tensor (torch.Tensor): The original tensor.
            new_tensor (torch.Tensor): The new tensor to compare against.
            threshold (float): The minimum difference to consider (for float tensors).
        
        Returns:
            dict: A dictionary containing the diff information.
        """
        if old_tensor.shape != new_tensor.shape:
            return {'type': 'full', 'data': new_tensor.cpu().numpy()}
        
        if old_tensor.dtype != new_tensor.dtype:
            return {'type': 'full', 'data': new_tensor.cpu().numpy()}
        
        if old_tensor.dtype in [torch.float32, torch.float64]:
            diff = (new_tensor - old_tensor).abs()
            mask = diff > threshold
        else:
            diff = new_tensor != old_tensor
            mask = diff
        
        if not mask.any():
            return {'type': 'no_change'}
        
        indices = torch.nonzero(mask).cpu().numpy()
        values = new_tensor[mask].cpu().numpy()
        
        if indices.size > 0.5 * new_tensor.numel():
            return {'type': 'full', 'data': new_tensor.cpu().numpy()}
        
        return {
            'type': 'sparse',
            'shape': new_tensor.shape,
            'indices': indices,
            'values': values
        }

    @staticmethod
    def apply_diff(old_tensor: torch.Tensor, diff: Dict[str, Union[str, np.ndarray, Tuple]]) -> torch.Tensor:
        """
        Apply a diff to a tensor to reconstruct the new tensor.
        
        Args:
            old_tensor (torch.Tensor): The original tensor.
            diff (dict): The diff information.
        
        Returns:
            torch.Tensor: The reconstructed new tensor.
        """
        if diff['type'] == 'no_change':
            return old_tensor
        
        if diff['type'] == 'full':
            return torch.from_numpy(diff['data'])
        
        if diff['type'] == 'sparse':
            new_tensor = old_tensor.clone()
            indices = tuple(map(tuple, diff['indices'].T))
            new_tensor[indices] = torch.from_numpy(diff['values'])
            return new_tensor
        
        raise ValueError(f"Unknown diff type: {diff['type']}")

    @staticmethod
    def compress_diff(diff: Dict[str, Union[str, np.ndarray, Tuple]]) -> bytes:
        """
        Compress the diff data for efficient transmission.
        
        Args:
            diff (dict): The diff information.
        
        Returns:
            bytes: Compressed diff data.
        """
        import zlib
        import pickle
        
        compressed = zlib.compress(pickle.dumps(diff))
        return compressed

    @staticmethod
    def decompress_diff(compressed_diff: bytes) -> Dict[str, Union[str, np.ndarray, Tuple]]:
        """
        Decompress the diff data.
        
        Args:
            compressed_diff (bytes): Compressed diff data.
        
        Returns:
            dict: The original diff information.
        """
        import zlib
        import pickle
        
        decompressed = pickle.loads(zlib.decompress(compressed_diff))
        return decompressed

    @staticmethod
    def estimate_diff_size(diff: Dict[str, Union[str, np.ndarray, Tuple]]) -> int:
        """
        Estimate the size of the diff in bytes.
        
        Args:
            diff (dict): The diff information.
        
        Returns:
            int: Estimated size in bytes.
        """
        if diff['type'] == 'no_change':
            return 8  # Assuming 8 bytes for the type string
        
        if diff['type'] == 'full':
            return diff['data'].nbytes + 8
        
        if diff['type'] == 'sparse':
            return (diff['indices'].nbytes + 
                    diff['values'].nbytes + 
                    sum(8 for _ in diff['shape']) + 
                    8)  # 8 bytes for each dimension in shape, 8 for type
        
        raise ValueError(f"Unknown diff type: {diff['type']}")
