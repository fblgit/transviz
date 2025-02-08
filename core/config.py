from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import yaml

@dataclass
class VizConfig:
    port: int = 8080
    mode: str = "hybrid"
    storage_path: str = "./viz_data"
    tensor_sampling: float = 1.0
    capture_gradients: bool = False
    ws_compression: bool = True
    buffer_size: int = 2048
    cors_origins: List[str] = field(default_factory=lambda: ["*"])
    distributed_strategy: Optional[str] = None
    sync_interval: int = 500
    log_level: str = "INFO"
    max_tensor_size: int = 1024 * 1024 * 10  # 10 MB
    breakpoint_timeout: int = 300  # 5 minutes
    custom_visualizers: Dict[str, str] = field(default_factory=dict)
    metrics_update_interval: int = 100
    tensor_diff_threshold: float = 1e-6
    enable_profiling: bool = False
    profiling_interval: int = 1000

    @classmethod
    def from_yaml(cls, file_path: str) -> 'VizConfig':
        """
        Load configuration from a YAML file.

        Args:
            file_path (str): Path to the YAML configuration file.

        Returns:
            VizConfig: Configuration object.
        """
        with open(file_path, 'r') as file:
            config_dict = yaml.safe_load(file)
        return cls(**config_dict)

    def to_yaml(self, file_path: str):
        """
        Save configuration to a YAML file.

        Args:
            file_path (str): Path to save the YAML configuration file.
        """
        with open(file_path, 'w') as file:
            yaml.dump(self.__dict__, file)

    def update(self, **kwargs):
        """
        Update configuration with new values.

        Args:
            **kwargs: Keyword arguments with new configuration values.
        """
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
            else:
                raise AttributeError(f"VizConfig has no attribute '{key}'")

    def validate(self):
        """
        Validate the configuration settings.

        Raises:
            ValueError: If any configuration setting is invalid.
        """
        if self.port < 1 or self.port > 65535:
            raise ValueError("Port must be between 1 and 65535")
        
        if self.mode not in ["light", "debug", "hybrid"]:
            raise ValueError("Mode must be 'light', 'debug', or 'hybrid'")
        
        if self.tensor_sampling <= 0 or self.tensor_sampling > 1:
            raise ValueError("Tensor sampling must be between 0 and 1")
        
        if self.sync_interval < 0:
            raise ValueError("Sync interval must be non-negative")
        
        if self.log_level not in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
            raise ValueError("Invalid log level")
        
        if self.max_tensor_size < 0:
            raise ValueError("Max tensor size must be non-negative")
        
        if self.breakpoint_timeout < 0:
            raise ValueError("Breakpoint timeout must be non-negative")
        
        if self.metrics_update_interval < 0:
            raise ValueError("Metrics update interval must be non-negative")
        
        if self.tensor_diff_threshold < 0:
            raise ValueError("Tensor diff threshold must be non-negative")
        
        if self.profiling_interval < 0:
            raise ValueError("Profiling interval must be non-negative")

    def __post_init__(self):
        self.validate()

def get_default_config() -> VizConfig:
    """
    Get the default configuration.

    Returns:
        VizConfig: Default configuration object.
    """
    return VizConfig()

def merge_configs(base_config: VizConfig, override_config: Dict[str, Any]) -> VizConfig:
    """
    Merge a base configuration with an override configuration.

    Args:
        base_config (VizConfig): Base configuration object.
        override_config (Dict[str, Any]): Dictionary with override values.

    Returns:
        VizConfig: Merged configuration object.
    """
    merged_config = VizConfig(**base_config.__dict__)
    merged_config.update(**override_config)
    return merged_config
