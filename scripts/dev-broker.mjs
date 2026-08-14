import { createServer } from 'node:http'
import { Aedes } from 'aedes'
import { createWebSocketStream, WebSocketServer } from 'ws'

const host = '127.0.0.1'
const port = Number(process.env.MQTTAPE_BROKER_PORT || 9001)
const broker = await Aedes.createBroker()
const server = createServer()
const websocketServer = new WebSocketServer({ server, path: '/mqtt' })

websocketServer.on('connection', (socket, request) => {
  broker.handle(createWebSocketStream(socket), request)
})

server.listen(port, host, () => {
  process.stdout.write(`MQTTape development broker listening on ws://${host}:${port}/mqtt\n`)
})

async function shutdown() {
  websocketServer.close()
  await new Promise((resolve) => server.close(resolve))
  await new Promise((resolve) => broker.close(resolve))
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
