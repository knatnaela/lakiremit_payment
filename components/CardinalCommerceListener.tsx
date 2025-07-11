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
      console.log('⚠️ Cardinal Commerce listener already active')
      return;
    }

    this.messageHandler = onMessage;
    this.isListening = true;

    console.log('🔧 Setting up Cardinal Commerce message listener...')
    
    window.addEventListener("message", this.handleMessage.bind(this), false)
    console.log('✅ Cardinal Commerce message listener started')
  }

  stopListening() {
    if (!this.isListening) {
      return;
    }

    window.removeEventListener("message", this.handleMessage.bind(this), false)
    this.isListening = false;
    this.messageHandler = null;
    console.log('🛑 Cardinal Commerce message listener stopped')
  }

  private handleMessage(event: MessageEvent) {
    console.log('🔍 Message event received from:', event.origin)
    console.log('🔍 Event type:', event.type)
    console.log('🔍 Event data type:', typeof event.data)
    console.log('🔍 Event data length:', event.data ? event.data.length : 'N/A')
    
    // Cardinal Commerce origins (test and production)
    const cardinalOrigins = [
      "https://centinelapistag.cardinalcommerce.com", // Test environment
      "https://centinelapi.cardinalcommerce.com"      // Production environment
    ];

    // Cybersource Flex origins (test and production)
    const flexOrigins = [
      "https://testflex.cybersource.com", // Test environment
      "https://flex.cybersource.com"      // Production environment
    ];

    if (cardinalOrigins.includes(event.origin)) {
      this.handleCardinalCommerceMessage(event);
    } else if (flexOrigins.includes(event.origin)) {
      this.handleFlexMessage(event);
    } else {
      console.log('⚠️ Message from unexpected origin:', event.origin)
      console.log('⚠️ Expected Cardinal origins:', cardinalOrigins)
      console.log('⚠️ Expected Flex origins:', flexOrigins)
    }
  }

  private handleCardinalCommerceMessage(event: MessageEvent) {
    console.log('📡 Cardinal Commerce message received from:', event.origin)
    console.log('📡 Raw event.data:', event.data)
    console.log('📡 Event.data type:', typeof event.data)
    console.log('📡 Event.data stringified:', JSON.stringify(event.data, null, 2))
    
    // Parse the message data if it's a string
    let messageData = event.data
    console.log('🔍 Initial messageData:', messageData)
    console.log('🔍 messageData type:', typeof messageData)
    
    if (typeof event.data === 'string') {
      console.log('🔍 Attempting to parse string data...')
      try {
        messageData = JSON.parse(event.data)
        console.log('🔍 Successfully parsed message data:', messageData)
        console.log('🔍 Parsed messageData type:', typeof messageData)
        console.log('🔍 Parsed messageData keys:', Object.keys(messageData))
      } catch (error) {
        console.error('❌ Failed to parse Cardinal Commerce message:', error)
        console.error('❌ Raw string that failed to parse:', event.data)
        return
      }
    }
    
    console.log('🔍 Message details:', {
      MessageType: messageData.MessageType,
      Status: messageData.Status,
      SessionId: messageData.SessionId
    })
    
    // Dump ALL Cardinal Commerce data
    console.log('📊 CARDINAL COMMERCE DATA DUMP:')
    console.log('📊 =========================')
    console.log('📊 Complete messageData object:', messageData)
    console.log('📊 All messageData properties:')
    for (const [key, value] of Object.entries(messageData)) {
      console.log(`📊   ${key}:`, value)
    }
    console.log('📊 =========================')
    
    // Call the message handler
    if (this.messageHandler) {
      this.messageHandler(messageData);
    }
  }

  private handleFlexMessage(event: MessageEvent) {
    console.log('🎫 Cybersource Flex message received from:', event.origin)
    console.log('🎫 Raw event.data:', event.data)
    console.log('🎫 Event.data type:', typeof event.data)
    console.log('🎫 Event.data stringified:', JSON.stringify(event.data, null, 2))
    
    // Parse the message data if it's a string
    let messageData = event.data
    console.log('🔍 Initial Flex messageData:', messageData)
    console.log('🔍 Flex messageData type:', typeof messageData)
    
    if (typeof event.data === 'string') {
      console.log('🔍 Attempting to parse Flex string data...')
      try {
        messageData = JSON.parse(event.data)
        console.log('🔍 Successfully parsed Flex message data:', messageData)
        console.log('🔍 Parsed Flex messageData type:', typeof messageData)
        console.log('🔍 Parsed Flex messageData keys:', Object.keys(messageData))
      } catch (error) {
        console.error('❌ Failed to parse Flex message:', error)
        console.error('❌ Raw Flex string that failed to parse:', event.data)
        return
      }
    }
    
    // Dump ALL Flex data
    console.log('🎫 FLEX DATA DUMP:')
    console.log('🎫 ===============')
    console.log('🎫 Complete Flex messageData object:', messageData)
    console.log('🎫 All Flex messageData properties:')
    for (const [key, value] of Object.entries(messageData)) {
      console.log(`🎫   ${key}:`, value)
    }
    console.log('🎫 ===============')
    
    // For now, just log Flex messages - you can add specific handling later
    console.log('ℹ️ Flex message received - no specific handling implemented yet')
  }
} 