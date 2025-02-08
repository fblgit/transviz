from typing import Dict, List, Optional, Any
import time
import threading
from transviz.core.config import VizConfig

class BreakpointStorage:
    def __init__(self, config: VizConfig):
        self.config = config
        self.breakpoints: Dict[str, Dict[str, Any]] = {}
        self.hit_history: Dict[str, List[Dict[str, Any]]] = {}
        self.lock = threading.Lock()

    def add_breakpoint(self, name: str, condition: Optional[str] = None, metadata: Optional[Dict] = None):
        with self.lock:
            self.breakpoints[name] = {
                'condition': condition,
                'metadata': metadata or {},
                'created_at': time.time(),
                'hit_count': 0
            }
            self.hit_history[name] = []

    def remove_breakpoint(self, name: str):
        with self.lock:
            if name in self.breakpoints:
                del self.breakpoints[name]
                del self.hit_history[name]

    def get_breakpoint(self, name: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            return self.breakpoints.get(name)

    def get_all_breakpoints(self) -> Dict[str, Dict[str, Any]]:
        with self.lock:
            return self.breakpoints.copy()

    def record_hit(self, name: str, data: Dict[str, Any]):
        with self.lock:
            if name in self.breakpoints:
                self.breakpoints[name]['hit_count'] += 1
                hit_data = {
                    'timestamp': time.time(),
                    'data': data
                }
                self.hit_history[name].append(hit_data)
                
                # Limit the hit history size
                if len(self.hit_history[name]) > self.config.breakpoint_history_size:
                    self.hit_history[name].pop(0)

    def get_hit_history(self, name: str) -> List[Dict[str, Any]]:
        with self.lock:
            return self.hit_history.get(name, [])

    def clear_hit_history(self, name: str):
        with self.lock:
            if name in self.hit_history:
                self.hit_history[name].clear()

    def update_breakpoint_condition(self, name: str, new_condition: str):
        with self.lock:
            if name in self.breakpoints:
                self.breakpoints[name]['condition'] = new_condition

    def update_breakpoint_metadata(self, name: str, metadata: Dict):
        with self.lock:
            if name in self.breakpoints:
                self.breakpoints[name]['metadata'].update(metadata)

    def get_breakpoint_statistics(self) -> Dict[str, Dict[str, Any]]:
        with self.lock:
            return {
                name: {
                    'hit_count': bp['hit_count'],
                    'last_hit': self.hit_history[name][-1]['timestamp'] if self.hit_history[name] else None,
                    'created_at': bp['created_at']
                }
                for name, bp in self.breakpoints.items()
            }

    def clear_all(self):
        with self.lock:
            self.breakpoints.clear()
            self.hit_history.clear()

    def get_active_breakpoints(self) -> List[str]:
        with self.lock:
            return [name for name, bp in self.breakpoints.items() if bp['hit_count'] > 0]

    def get_storage_usage(self) -> Dict[str, int]:
        with self.lock:
            return {
                'num_breakpoints': len(self.breakpoints),
                'total_hits': sum(len(hits) for hits in self.hit_history.values())
            }
