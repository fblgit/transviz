from typing import Dict, List, Optional, Tuple
import time
import threading
import numpy as np
from collections import deque
from transviz.core.config import VizConfig

class MetricStorage:
    def __init__(self, config: VizConfig):
        self.config = config
        self.metrics: Dict[str, deque] = {}
        self.metadata: Dict[str, Dict] = {}
        self.lock = threading.Lock()
        self.last_update: Dict[str, float] = {}

    def add_metric(self, name: str, value: float, step: Optional[int] = None):
        with self.lock:
            if name not in self.metrics:
                self.metrics[name] = deque(maxlen=self.config.metric_history_size)
                self.metadata[name] = {'min': value, 'max': value}
            
            timestamp = time.time()
            self.metrics[name].append((step, timestamp, value))
            self.last_update[name] = timestamp
            
            # Update metadata
            self.metadata[name]['min'] = min(self.metadata[name]['min'], value)
            self.metadata[name]['max'] = max(self.metadata[name]['max'], value)
            
            self._cleanup_old_metrics()

    def get_metric(self, name: str) -> List[Tuple[Optional[int], float, float]]:
        with self.lock:
            return list(self.metrics.get(name, []))

    def get_metric_names(self) -> List[str]:
        with self.lock:
            return list(self.metrics.keys())

    def get_metric_metadata(self, name: str) -> Optional[Dict]:
        with self.lock:
            return self.metadata.get(name)

    def remove_metric(self, name: str):
        with self.lock:
            if name in self.metrics:
                del self.metrics[name]
                del self.metadata[name]
                del self.last_update[name]

    def _cleanup_old_metrics(self):
        current_time = time.time()
        metrics_to_remove = [
            name for name, last_update in self.last_update.items()
            if current_time - last_update > self.config.metric_retention_period
        ]
        for name in metrics_to_remove:
            self.remove_metric(name)

    def get_storage_usage(self) -> Dict[str, int]:
        with self.lock:
            return {
                'num_metrics': len(self.metrics),
                'total_datapoints': sum(len(metric) for metric in self.metrics.values())
            }

    def get_metric_statistics(self, name: str) -> Optional[Dict]:
        with self.lock:
            if name in self.metrics:
                values = [value for _, _, value in self.metrics[name]]
                return {
                    'mean': float(np.mean(values)),
                    'std': float(np.std(values)),
                    'min': float(np.min(values)),
                    'max': float(np.max(values)),
                    'count': len(values)
                }
            return None

    def get_metric_range(self, name: str, start_time: float, end_time: float) -> List[Tuple[Optional[int], float, float]]:
        with self.lock:
            if name in self.metrics:
                return [
                    (step, timestamp, value)
                    for step, timestamp, value in self.metrics[name]
                    if start_time <= timestamp <= end_time
                ]
            return []

    def clear_all(self):
        with self.lock:
            self.metrics.clear()
            self.metadata.clear()
            self.last_update.clear()

    def get_latest_metrics(self) -> Dict[str, float]:
        with self.lock:
            return {
                name: metric[-1][2] if metric else None
                for name, metric in self.metrics.items()
            }

    def get_metric_summary(self, name: str) -> Optional[Dict]:
        with self.lock:
            if name in self.metrics:
                values = [value for _, _, value in self.metrics[name]]
                return {
                    'name': name,
                    'last_value': values[-1] if values else None,
                    'min': self.metadata[name]['min'],
                    'max': self.metadata[name]['max'],
                    'num_datapoints': len(values),
                    'last_update': self.last_update[name]
                }
            return None
