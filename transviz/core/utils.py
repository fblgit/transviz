import torch
import numpy as np
from typing import Dict, Any

def tensor_to_bytes(tensor: torch.Tensor) -> bytes:
    """
    Convert a PyTorch tensor to bytes.
    
    Args:
        tensor (torch.Tensor): The input tensor.
    
    Returns:
        bytes: The tensor data as bytes.
    """
    return tensor.numpy().tobytes()

def bytes_to_tensor(data: bytes, shape: tuple, dtype: torch.dtype) -> torch.Tensor:
    """
    Convert bytes back to a PyTorch tensor.
    
    Args:
        data (bytes): The tensor data as bytes.
        shape (tuple): The shape of the tensor.
        dtype (torch.dtype): The data type of the tensor.
    
    Returns:
        torch.Tensor: The reconstructed tensor.
    """
    return torch.from_numpy(np.frombuffer(data, dtype=dtype.as_numpy_dtype).reshape(shape))

def get_tensor_stats(tensor: torch.Tensor) -> Dict[str, float]:
    """
    Compute basic statistics for a tensor.
    
    Args:
        tensor (torch.Tensor): The input tensor.
    
    Returns:
        dict: A dictionary containing mean, std, min, max, and norm of the tensor.
    """
    return {
        'mean': tensor.mean().item(),
        'std': tensor.std().item(),
        'min': tensor.min().item(),
        'max': tensor.max().item(),
        'norm': tensor.norm().item()
    }

def tensor_memory_usage(tensor: torch.Tensor) -> int:
    """
    Calculate the memory usage of a tensor in bytes.
    
    Args:
        tensor (torch.Tensor): The input tensor.
    
    Returns:
        int: Memory usage in bytes.
    """
    return tensor.element_size() * tensor.nelement()

def format_size(size_bytes: int) -> str:
    """
    Format a size in bytes to a human-readable string.
    
    Args:
        size_bytes (int): Size in bytes.
    
    Returns:
        str: Formatted size string (e.g., "1.23 MB").
    """
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"

def is_notebook() -> bool:
    """
    Check if the code is running in a Jupyter notebook.
    
    Returns:
        bool: True if running in a notebook, False otherwise.
    """
    try:
        shell = get_ipython().__class__.__name__
        if shell == 'ZMQInteractiveShell':
            return True   # Jupyter notebook or qtconsole
        elif shell == 'TerminalInteractiveShell':
            return False  # Terminal running IPython
        else:
            return False  # Other type (?)
    except NameError:
        return False      # Probably standard Python interpreter

def safe_isinstance(obj: Any, class_or_tuple: Any) -> bool:
    """
    Safely check if an object is an instance of a class or tuple of classes.
    This function handles cases where the class might not be available in the current environment.
    
    Args:
        obj (Any): The object to check.
        class_or_tuple (Any): A class or tuple of classes to check against.
    
    Returns:
        bool: True if obj is an instance of class_or_tuple, False otherwise.
    """
    try:
        return isinstance(obj, class_or_tuple)
    except Exception:
        return False

def get_object_size(obj: Any) -> int:
    """
    Get the size of an object in bytes.
    
    Args:
        obj (Any): The object to measure.
    
    Returns:
        int: Size of the object in bytes.
    """
    import sys
    return sys.getsizeof(obj)

def truncate_string(s: str, max_length: int = 100) -> str:
    """
    Truncate a string to a maximum length, adding an ellipsis if truncated.
    
    Args:
        s (str): The input string.
        max_length (int): The maximum length of the string.
    
    Returns:
        str: The truncated string.
    """
    return (s[:max_length] + '...') if len(s) > max_length else s
