from .api import create_server
from .websockets import WebSocketManager
from .storage import TensorStorage, MetricStorage, BreakpointStorage

__all__ = [
    'create_server',
    'WebSocketManager',
    'TensorStorage',
    'MetricStorage',
    'BreakpointStorage'
]

# Version of the server module
__version__ = '0.1.0'

# Initialize default configurations
default_config = {
    'host': '0.0.0.0',
    'port': 8000,
    'debug': False,
    'reload': False
}

def get_version():
    return __version__

def get_default_config():
    return default_config.copy()
