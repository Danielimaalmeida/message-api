class Connection {
    functions = {};
    executingFunctions = {};

    constructor(port) {
        this.port = port;
        this.port.onmessage = this.handleOnMessage.bind(this);
    }

    // Handles incoming messages
    handleOnMessage(event) {
        const { messageId, result, functionName } = event.data;

        if (result) {
            // Resolve the promise for a function call
            if (this.executingFunctions[messageId]) {
                this.executingFunctions[messageId].resolve(result);
                delete this.executingFunctions[messageId];
            }
        } else if (this.functions[functionName]) {
            // Execute the registered function
            this.functions[functionName](event.data);
        }
    }

    // Registers a function that can be called from the other side
    registerFunction(functionName, callback) {
        this.functions[functionName] = async (data) => {
            const result = await callback(data);
            this.sendResult(result, data.messageId);
        };
    }

    // Calls a registered function on the other side
    callApiFunction(functionName, params) {
        return new Promise((resolve) => {
            const messageId = this.generateMessageId();
            this.executingFunctions[messageId] = { resolve };
            this.port.postMessage({ messageId, functionName, ...params });
        });
    }

    // Sends the result back to the caller
    sendResult(result, messageId) {
        this.port.postMessage({ result, messageId });
    }

    // Generates a unique message identifier
    generateMessageId() {
        const timestamp = Date.now();
        const randomComponent = Math.floor(Math.random() * 1000000);
        return `${timestamp}-${randomComponent}`;
    }
}


class Host {
    connection;

    // Creates a connection to an iframe
    createConnection(iframe) {
        console.log(iframe)
        return new Promise((resolve) => {
            const channel = new MessageChannel();
            const connection = new Connection(channel.port1);
            iframe.onload = () => {
                iframe.contentWindow.postMessage('workplaceConnection', '*', [channel.port2]);
                resolve(connection);
            };
        });
    }

    // Retrieves the client connection
    getClient() {
        return new Promise((resolve) => {
            if (this.connection) {
                resolve(this.connection);
                return;
            }

            window.addEventListener("message", (event) => {
                if (event.data === 'workplaceConnection') {
                    this.connection = new Connection(event.ports[0]);
                    resolve(this.connection);
                }
            });
        });
    }
}

const host = new Host();