import numpy as np
from typing import Dict, Optional, List, Tuple
import threading
import time
from transviz.core.config import VizConfig
from transviz.core.diff_engine import TensorDiff

class TensorStorage:
    def __init__(self, config: VizConfig):
        self.config = config
        self.tensors: Dict[str, np.ndarray] = {}
        self.metadata: Dict[str, Dict] = {}
        self.lock = threading.Lock()
        self.last_access: Dict[str, float] = {}

    def update_tensor(self, name: str, data: np.ndarray, metadata: Optional[Dict] = None) -> Dict:
        with self.lock:
            if name in self.tensors:
                diff = TensorDiff.compute_diff(self.tensors[name], data, self.config.tensor_diff_threshold)
            else:
                diff = {'type': 'full', 'data': data}
            
            self.tensors[name] = data
            self.last_access[name] = time.time()
            
            if metadata:
                self.metadata[name] = metadata
            elif name not in self.metadata:
                self.metadata[name] = {
                    'shape': data.shape,
                    'dtype': str(data.dtype)
                }
            
            self._cleanup_old_tensors()
            
            return diff

    def get_tensor(self, name: str) -> Optional[np.ndarray]:
        with self.lock:
            if name in self.tensors:
                self.last_access[name] = time.time()
                return self.tensors[name]
            return None

    def get_tensor_metadata(self, name: str) -> Optional[Dict]:
        with self.lock:
            return self.metadata.get(name)

    def get_tensor_names(self) -> List[str]:
        with self.lock:
            return list(self.tensors.keys())

    def remove_tensor(self, name: str):
        with self.lock:
            if name in self.tensors:
                del self.tensors[name]
                del self.metadata[name]
                del self.last_access[name]

    def _cleanup_old_tensors(self):
        current_time = time.time()
        tensors_to_remove = [
            name for name, last_access in self.last_access.items()
            if current_time - last_access > self.config.tensor_retention_period
        ]
        for name in tensors_to_remove:
            self.remove_tensor(name)

    def get_storage_usage(self) -> Dict[str, int]:
        with self.lock:
            return {
                'num_tensors': len(self.tensors),
                'total_memory': sum(tensor.nbytes for tensor in self.tensors.values())
            }

    def get_tensor_slice(self, name: str, start: List[int], end: List[int]) -> Optional[np.ndarray]:
        with self.lock:
            if name in self.tensors:
                tensor = self.tensors[name]
                slices = tuple(slice(s, e) for s, e in zip(start, end))
                return tensor[slices]
            return None

    def get_tensor_statistics(self, name: str) -> Optional[Dict]:
        with self.lock:
            if name in self.tensors:
                tensor = self.tensors[name]
                return {
                    'mean': float(np.mean(tensor)),
                    'std': float(np.std(tensor)),
                    'min': float(np.min(tensor)),
                    'max': float(np.max(tensor)),
                    'shape': tensor.shape,
                    'dtype': str(tensor.dtype)
                }
            return None

    def compress_tensor(self, name: str) -> Optional[bytes]:
        with self.lock:
            if name in self.tensors:
                return TensorDiff.compress_diff({'type': 'full', 'data': self.tensors[name]})
            return None

    def decompress_tensor(self, compressed_data: bytes) -> np.ndarray:
        diff = TensorDiff.decompress_diff(compressed_data)
        return diff['data']

    def clear_all(self):
        with self.lock:
            self.tensors.clear()
            self.metadata.clear()
            self.last_access.clear()
