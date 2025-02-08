import torch
from typing import Dict, Optional
from .breakpoints import BreakpointManager
from .config import VizConfig
from .diff_engine import TensorDiff
from .utils import get_tensor_stats
from functools import wraps
from transviz.server.api import create_server
import threading

# Modified trace decorator
def trace(name, capture_shapes=True, capture_gradients=False):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Get active visualizer instance
            visualizer = ModelVisualizer.get_instance()
            if not visualizer:
                return func(*args, **kwargs)

            # Pre-execution logic
            visualizer.log_tensor(f"{name}_input", args[0])
            
            # Execute original function
            result = func(*args, **kwargs)
            
            # Post-execution logic
            visualizer.log_tensor(name, result)
            
            if capture_gradients:
                result.register_hook(
                    lambda grad: visualizer.log_tensor(f"{name}_grad", grad)
                )
            
            # Check breakpoints
            if visualizer.check_breakpoint(name, result):
                visualizer.handle_breakpoint(name, result)

            return result
        return wrapper
    return decorator

class ModelVisualizer:
    _instance = None

    def __init__(self, config: VizConfig):
        if ModelVisualizer._instance:
            raise RuntimeError("Use ModelVisualizer.get_instance() after initialization")
        ModelVisualizer._instance = self
        self.config = config
        self.breakpoint_manager = BreakpointManager()
        self.server = None
        self.tensor_cache = {}
        self.metrics_history = {}
        # Add server thread management
        self.server_thread = None
        self.server_running = False

    def start(self):
        """Start the visualization server in a background thread"""
        
        if not self.server_running:
            self.server = create_server(self)
            self.server_thread = threading.Thread(
                target=self.server.run,
                kwargs={'host': 'localhost', 'port': self.config.port}
            )
            self.server_thread.daemon = True
            self.server_thread.start()
            self.server_running = True

    @classmethod
    def get_instance(cls):
        return cls._instance

    def stop(self):
        # Stop the visualization server
        if self.server:
            self.server.stop()

    def log_tensor(self, name: str, tensor: torch.Tensor):
        if self.config.mode == "light":
            # Only log metadata in light mode
            self.server.broadcast({
                "type": "tensor_update",
                "name": name,
                "shape": tensor.shape,
                "dtype": str(tensor.dtype),
                "stats": get_tensor_stats(tensor)
            })
        else:
            # Compute diff if tensor exists in cache
            if name in self.tensor_cache:
                diff = TensorDiff.compute_diff(self.tensor_cache[name], tensor)
                self.server.broadcast({
                    "type": "tensor_diff",
                    "name": name,
                    "diff": diff
                })
            else:
                # Send full tensor data for first update
                self.server.broadcast({
                    "type": "tensor_full",
                    "name": name,
                    "data": tensor.numpy().tolist(),
                    "shape": tensor.shape,
                    "dtype": str(tensor.dtype)
                })
            
            # Update cache
            self.tensor_cache[name] = tensor.detach().cpu()

    def log_metrics(self, metrics: Dict[str, float], step: Optional[int] = None):
        for name, value in metrics.items():
            if name not in self.metrics_history:
                self.metrics_history[name] = []
            self.metrics_history[name].append((step, value))

        self.server.broadcast({
            "type": "metrics_update",
            "metrics": metrics,
            "step": step
        })

    def set_breakpoint(self, name: str, condition=None):
        self.breakpoint_manager.add_breakpoint(name, condition)

    def remove_breakpoint(self, name: str):
        self.breakpoint_manager.remove_breakpoint(name)

    def check_breakpoint(self, name: str, tensor: torch.Tensor) -> bool:
        return self.breakpoint_manager.check_breakpoint(name, tensor)

    def handle_breakpoint(self, name: str, tensor: torch.Tensor):
        if self.check_breakpoint(name, tensor):
            self.server.broadcast({
                "type": "breakpoint_hit",
                "name": name,
                "tensor_name": f"breakpoint_{name}",
            })
            self.log_tensor(f"breakpoint_{name}", tensor)
            # Wait for user input or timeout
            self.server.wait_for_resume()

    def get_metrics_history(self):
        return self.metrics_history

    def clear_tensor_cache(self):
        self.tensor_cache.clear()

    def set_config(self, **kwargs):
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
            else:
                raise AttributeError(f"Config has no attribute '{key}'")
