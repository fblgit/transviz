# Core functionality exports
from .core import (
    trace,
    ModelVisualizer,
    VizConfig,
    TensorDiff,
    BreakpointManager
)

# Server functionality exports
from .server import (
    create_server,
    WebSocketManager,
    TensorStorage,
    MetricStorage,
    BreakpointStorage
)

# Version alignment
__version__ = "0.1.0"

# Package-level initialization
def _initialize_package():
    """Internal package initialization routine"""
    # Configure default logging
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

_initialize_package()

__all__ = [
    # Core components
    'trace',
    'ModelVisualizer',
    'VizConfig',
    'TensorDiff',
    'BreakpointManager',
    
    # Server components
    'create_server',
    'WebSocketManager',
    'TensorStorage',
    'MetricStorage',
    'BreakpointStorage',
    
    # Version
    '__version__'
]
