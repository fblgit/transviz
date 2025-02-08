from fastapi import WebSocket
from typing import List, Dict, Any
import asyncio
import json

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_ids: Dict[WebSocket, str] = {}
        self.message_queue: asyncio.Queue = asyncio.Queue()
        self._loop = None  # Will be set when async startup runs
        # Do not start any async tasks here; they must be scheduled once the event loop is running.

    async def start(self):
        """
        Called at startup (from FastAPI startup event) so that the event loop
        is available. This method sets the loop and starts the broadcast worker.
        """
        self._loop = asyncio.get_running_loop()
        # Start the broadcast worker (an async task) in the running event loop.
        asyncio.create_task(self.broadcast_worker())

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_ids[websocket] = f"client_{len(self.active_connections)}"
        await self.send_message(websocket, {
            "type": "connection_established",
            "client_id": self.connection_ids[websocket]
        })

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            del self.connection_ids[websocket]

    async def send_message(self, websocket: WebSocket, message: Dict[str, Any]):
        await websocket.send_json(message)

    async def broadcast(self, message: Dict[str, Any]):
        await self.message_queue.put(message)

    async def broadcast_worker(self):
        while True:
            message = await self.message_queue.get()
            await self._broadcast(message)
            self.message_queue.task_done()

    async def _broadcast(self, message: Dict[str, Any]):
        for connection in self.active_connections:
            try:
                await self.send_message(connection, message)
            except Exception as e:
                print(f"Error sending message to {self.connection_ids.get(connection, 'unknown')}: {e}")
                self.disconnect(connection)

    async def broadcast_tensor_update(self, tensor_name: str, tensor_data: Any):
        await self.broadcast({
            "type": "tensor_update",
            "tensor_name": tensor_name,
            "data": tensor_data
        })

    async def broadcast_metrics_update(self, metrics: Dict[str, float]):
        await self.broadcast({
            "type": "metrics_update",
            "metrics": metrics
        })

    async def broadcast_breakpoint_hit(self, breakpoint_name: str, tensor_name: str):
        await self.broadcast({
            "type": "breakpoint_hit",
            "breakpoint_name": breakpoint_name,
            "tensor_name": tensor_name
        })

    def get_active_connections_count(self):
        return len(self.active_connections)

    async def ping_clients(self):
        await self.broadcast({"type": "ping"})

    async def wait_for_client_response(self, websocket: WebSocket, timeout: float = 5.0):
        try:
            response = await asyncio.wait_for(websocket.receive_json(), timeout=timeout)
            return response
        except asyncio.TimeoutError:
            print(f"Timeout waiting for response from {self.connection_ids.get(websocket, 'unknown')}")
            return None

    async def request_client_action(self, websocket: WebSocket, action: str, data: Dict[str, Any] = None):
        request = {"type": "action_request", "action": action}
        if data:
            request["data"] = data
        await self.send_message(websocket, request)
        return await self.wait_for_client_response(websocket, timeout=5.0)

    # --- Synchronous wrapper methods ---
    def sync_broadcast(self, message: Dict[str, Any]):
        """
        Synchronous wrapper that schedules broadcast(message) in the correct event loop.
        It does not wait for the coroutine to finish.
        """
        if self._loop is None:
            raise RuntimeError("WebSocketManager event loop not initialized. "
                               "Ensure that ws_manager.start() is called during server startup.")
        # Schedule the broadcast coroutine in the event loop without waiting.
        asyncio.run_coroutine_threadsafe(self.broadcast(message), self._loop)
        print(f'Sent message {message}')

    def sync_send_message(self, websocket: WebSocket, message: Dict[str, Any]):
        """
        Synchronous wrapper for send_message.
        """
        if self._loop is None:
            raise RuntimeError("WebSocketManager event loop not initialized.")
        asyncio.run_coroutine_threadsafe(self.send_message(websocket, message), self._loop)

