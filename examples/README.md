# Examples

## Simple
```
from transviz import *
import torch
config = VizConfig(port=8080)
visualizer = ModelVisualizer(config)
visualizer.start()

@trace("attention")
def forward(x):
    return x

forward(torch.tensor(5))
```

We are able to see:
```
>>> forward(torch.tensor(5))
Sent message {'type': 'tensor_full', 'name': 'attention_input', 'data': 5, 'shape': torch.Size([]), 'dtype': 'torch.int64'}
Sent message {'type': 'tensor_full', 'name': 'attention', 'data': 5, 'shape': torch.Size([]), 'dtype': 'torch.int64'}
```

Then we modify the forward function:
```
@trace("attention")
def forward(x):
    return x
```

and the result is:
```
>>> forward(torch.tensor(5))
Sent message {'type': 'tensor_diff', 'name': 'attention_input', 'diff': {'type': 'no_change'}}
Sent message {'type': 'tensor_diff', 'name': 'attention', 'diff': {'type': 'sparse', 'shape': torch.Size([]), 'indices': array([], shape=(1, 0), dtype=int64), 'values': array([10])}}
tensor(10)
```
