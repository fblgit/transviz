# TransViz - Neural Network Visualization Toolkit

![TransViz Demo](docs/demo.gif) <!-- Add actual demo media later -->

## STILLS UNDER EARLY PHASES OF DEVELOPMENT

A real-time visualization and debugging toolkit for neural networks, featuring:

- 🎮 Interactive tensor inspection
- ⏯️ Training process time travel
- 🔍 Breakpoint debugging system
- 📊 Real-time metrics dashboard
- 🔗 Distributed training support

## Key Features

- **Real-time Visualization**: Monitor activations/gradients during forward/backward passes
- **Breakpoint System**: Set conditional breakpoints with tensor pattern matching
- **Metrics Dashboard**: Track loss, accuracy, and custom metrics in real-time
- **Differential Updates**: Efficient binary diffs for large tensor visualization
- **Multi-Framework Support**: Designed for PyTorch with extensibility for other frameworks

## Installation

```
# Clone repository
git clone https://github.com/fblgit/transviz.git
cd transviz

# Install dependencies
pip install -r requirements.txt
```

## Quick Start

```
from transviz import visualize, VizConfig

# Instrument your model
@visualize.trace(name="transformer_block")
class TransformerBlock(nn.Module):
    def forward(self, x):
        x = self.attention(x)
        visualize.breakpoint("post_attention", x)
        return self.ffn(x)

# Initialize visualizer
viz = visualize.ModelVisualizer(
    VizConfig(
        port=8080,
        mode="hybrid",
        capture_gradients=True
    )
)
viz.start()

# Train your model normally
train(model, dataloader)
```

Access the visualization dashboard at `http://localhost:8080`

## Configuration

```
@dataclass
class VizConfig:
    port: int = 8080              # Web server port
    mode: str = "hybrid"          # light|hybrid|debug
    storage_path: str = "./viz_data"
    tensor_sampling: float = 0.1  # Fraction of data to capture
    capture_gradients: bool = False
    breakpoint_timeout: int = 300  # seconds
```

## API Reference

### Decorators
```
@visualize.trace(name="layer", capture_shapes=True)
@visualize.breakpoint("attention_weights", condition=lambda t: t.max() > 1.0)
```

### Core Methods
```
visualize.log_metrics({"loss": 0.5})
visualize.set_breakpoint("gradient_check", condition=has_nan)
visualize.save_session("training_run_1")
```

### CLI Commands
```
transviz serve --port 8080 --model ./checkpoint.pth
transviz export --session latest --format hdf5
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request


**Roadmap**  
[ ] TensorFlow/Keras support  
[ ] Jupyter notebook integration  
[ ] Pre-trained model zoo integration  
[ ] 3D tensor visualization  
