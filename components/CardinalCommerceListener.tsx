export class CardinalCommerceListener {
  private static instance: CardinalCommerceListener;
  private isListening = false;
  private messageHandler: ((data: any) => void) | null = null;

  private constructor() {}

  static getInstance(): CardinalCommerceListener {
    if (!CardinalCommerceListener.instance) {
      CardinalCommerceListener.instance = new CardinalCommerceListener();
    }
    return CardinalCommerceListener.instance;
  }

  startListening(onMessage: (data: any) => void) {
    if (this.isListening) {
      return;
    }

    this.messageHandler = onMessage;
    this.isListening = true;

    window.addEventListener("message", this.handleMessage.bind(this), false)
  }

  stopListening() {
    if (!this.isListening) {
      return;
    }

    window.removeEventListener("message", this.handleMessage.bind(this), false)
    this.isListening = false;
    this.messageHandler = null;
  }

  private handleMessage(event: MessageEvent) {
    
    // Cardinal Commerce origins (test and production)
    const cardinalOrigins = [
      "https://centinelapistag.cardinalcommerce.com", // Test environment
      "https://centinelapi.cardinalcommerce.com"      // Production environment
    ];

   

    if (cardinalOrigins.includes(event.origin)) {
      this.handleCardinalCommerceMessage(event);
    }
  }

  private handleCardinalCommerceMessage(event: MessageEvent) {
    console.log('Cardinal Commerce message received from origin:', event.origin)
    console.log('Cardinal Commerce raw message data:', event.data)
    
    // Parse the message data if it's a string
    let messageData = event.data
    
    if (typeof event.data === 'string') {
      try {
        messageData = JSON.parse(event.data)
        console.log('Cardinal Commerce parsed message data:', messageData)
      } catch (error) {
        console.log('Cardinal Commerce message parsing error:', error)
        return
      }
    }
    
    // Call the message handler
    if (this.messageHandler) {
      console.log('Calling Cardinal Commerce message handler')
      this.messageHandler(messageData);
    } else {
      console.log('No Cardinal Commerce message handler registered')
    }
  }

} 