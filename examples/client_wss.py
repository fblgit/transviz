from websocket import create_connection
import time

ws = create_connection("ws://127.0.0.1:8080/ws")
print(ws.recv())
while True:
    print("Receiving...")
    result =  ws.recv()
    print("Received '%s'" % result)
    time.sleep(0.3)
ws.close()
