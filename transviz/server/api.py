from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List
import asyncio
import json
from transviz.core.config import VizConfig
#from transviz.core import ModelVisualizer
from .websockets import WebSocketManager
from .storage import TensorStorage

app = FastAPI()
ws_manager = WebSocketManager()
#tensor_storage = TensorStorage()

class ModelVisualizer:
    def __init__(self, config: VizConfig):
        self.config = config

def create_server(visualizer: ModelVisualizer):
    app.state.visualizer = visualizer
    app.state.ws_manager = ws_manager
    app.state.tensor_storage = TensorStorage(visualizer.config)
    
    # Initialize async components when server starts
    @app.on_event("startup")
    async def startup_event():
        await ws_manager.start()  # Initialize async tasks here

    app.add_middleware(
        CORSMiddleware,
        allow_origins=visualizer.config.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await handle_websocket_message(websocket, data)
    except Exception as e:
        print(f"WebSocket error: {e}")
    try:
        if websocket is not None and ws_manager is not None:
            await ws_manager.disconnect(websocket)
    except:
        pass

async def handle_websocket_message(websocket: WebSocket, data: str):
    message = json.loads(data)
    if message['type'] == 'request_tensor':
        tensor_name = message['tensor_name']
        tensor_data = tensor_storage.get_tensor(tensor_name)
        if tensor_data is not None:
            await websocket.send_json({
                'type': 'tensor_data',
                'tensor_name': tensor_name,
                'data': tensor_data.tolist()
            })
        else:
            await websocket.send_json({
                'type': 'error',
                'message': f'Tensor {tensor_name} not found'
            })

class TensorUpdate(BaseModel):
    name: str
    data: List[float]
    shape: List[int]

@app.post("/update_tensor")
async def update_tensor(tensor: TensorUpdate, background_tasks: BackgroundTasks):
    tensor_storage.update_tensor(tensor.name, tensor.data, tensor.shape)
    background_tasks.add_task(broadcast_tensor_update, tensor.name)
    return {"status": "success"}

async def broadcast_tensor_update(tensor_name: str):
    await ws_manager.broadcast(json.dumps({
        'type': 'tensor_updated',
        'tensor_name': tensor_name
    }))

@app.get("/tensor_names")
async def get_tensor_names():
    return {"tensor_names": tensor_storage.get_tensor_names()}

@app.get("/tensor_metadata/{tensor_name}")
async def get_tensor_metadata(tensor_name: str):
    metadata = tensor_storage.get_tensor_metadata(tensor_name)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Tensor not found")
    return metadata

@app.post("/log_metrics")
async def log_metrics(metrics: Dict[str, float]):
    # Here you would typically store or process the metrics
    # For now, we'll just broadcast them to all connected clients
    await ws_manager.broadcast(json.dumps({
        'type': 'metrics_update',
        'metrics': metrics
    }))
    return {"status": "success"}

@app.get("/config")
async def get_config():
    return app.state.visualizer.config.__dict__

@app.post("/update_config")
async def update_config(config_update: Dict[str, Any]):
    try:
        app.state.visualizer.config.update(**config_update)
        return {"status": "success"}
    except AttributeError as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
