from typing import Callable, Optional, Dict
import torch

class Breakpoint:
    def __init__(self, name: str, condition: Optional[Callable] = None):
        self.name = name
        self.condition = condition
        self.enabled = True

    def should_break(self, tensor: torch.Tensor) -> bool:
        if not self.enabled:
            return False
        if self.condition is None:
            return True
        return self.condition(tensor)

    def enable(self):
        self.enabled = True

    def disable(self):
        self.enabled = False

class BreakpointManager:
    def __init__(self):
        self.breakpoints: Dict[str, Breakpoint] = {}

    def add_breakpoint(self, name: str, condition: Optional[Callable] = None):
        self.breakpoints[name] = Breakpoint(name, condition)

    def remove_breakpoint(self, name: str):
        if name in self.breakpoints:
            del self.breakpoints[name]

    def enable_breakpoint(self, name: str):
        if name in self.breakpoints:
            self.breakpoints[name].enable()

    def disable_breakpoint(self, name: str):
        if name in self.breakpoints:
            self.breakpoints[name].disable()

    def check_breakpoint(self, name: str, tensor: torch.Tensor) -> bool:
        if name in self.breakpoints:
            return self.breakpoints[name].should_break(tensor)
        return False

    def get_all_breakpoints(self) -> Dict[str, bool]:
        return {name: bp.enabled for name, bp in self.breakpoints.items()}

    def clear_all_breakpoints(self):
        self.breakpoints.clear()

    def set_global_condition(self, condition: Callable):
        for breakpoint in self.breakpoints.values():
            original_condition = breakpoint.condition
            breakpoint.condition = lambda tensor: global_condition(tensor) and (original_condition(tensor) if original_condition else True)

def tensor_condition(func):
    """
    Decorator for creating tensor conditions
    """
    def wrapper(tensor: torch.Tensor) -> bool:
        return func(tensor)
    return wrapper

@tensor_condition
def has_nan(tensor: torch.Tensor) -> bool:
    return torch.isnan(tensor).any()

@tensor_condition
def has_inf(tensor: torch.Tensor) -> bool:
    return torch.isinf(tensor).any()

@tensor_condition
def exceeds_threshold(tensor: torch.Tensor, threshold: float) -> bool:
    return (tensor.abs() > threshold).any()
