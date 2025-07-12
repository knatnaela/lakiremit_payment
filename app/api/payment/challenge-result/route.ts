import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const transactionId = formData.get('TransactionId')
    const response = formData.get('Response')
    const md = formData.get('MD')
    const status = formData.get('Status')

    console.log('📥 Challenge result received:', {
      transactionId,
      response,
      md,
      status,
      userAgent: request.headers.get('user-agent')
    })

    // Check if this is coming from an iframe
    const referer = request.headers.get('referer')
    // const isIframe = referer && !referer.includes(request.nextUrl.origin)

    // if (isIframe) {
      // Option A: Return HTML page that uses window.postMessage
      const baseUrl = 'http://localhost:3000' // In production, use your actual domain
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>3D Secure Authentication Complete</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 40px 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: rgba(255, 255, 255, 0.1);
              padding: 30px;
              border-radius: 10px;
              backdrop-filter: blur(10px);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            .success-icon {
              font-size: 48px;
              margin-bottom: 20px;
            }
            h1 {
              margin: 0 0 10px 0;
              font-size: 24px;
            }
            p {
              margin: 0 0 20px 0;
              opacity: 0.9;
            }
            .loading {
              display: inline-block;
              width: 20px;
              height: 20px;
              border: 3px solid rgba(255, 255, 255, 0.3);
              border-radius: 50%;
              border-top-color: white;
              animation: spin 1s ease-in-out infinite;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Authentication Complete</h1>
            <p>Your payment is being processed...</p>
            <div class="loading"></div>
          </div>
          
          <script>
            (function() {
              // Security: Verify we're in an iframe
              if (window === window.top) {
                console.error('❌ This page should only be loaded in an iframe');
                return;
              }

              // Prepare the message data
              const messageData = {
                type: '3ds-challenge-complete',
                transactionId: '${transactionId}',
                md: '${md}',
                status: '${status || 'success'}',
                response: '${response}',
                timestamp: new Date().toISOString()
              };

              // Security: Use specific target origin instead of '*'
              const targetOrigin = '${baseUrl}';
              
              // Send message to parent window
              try {
                window.parent.postMessage(messageData, targetOrigin);
                console.log('✅ Challenge completion message sent to parent:', messageData);
                
                // Optional: Show success message briefly before closing
                setTimeout(() => {
                  // You could close the iframe here if needed
                  // window.parent.postMessage({ type: 'close-iframe' }, targetOrigin);
                }, 2000);
                
              } catch (error) {
                console.error('❌ Error sending message to parent:', error);
                
                // Fallback: Try with '*' if specific origin fails
                try {
                  window.parent.postMessage(messageData, '*');
                  console.log('✅ Fallback message sent with wildcard origin');
                } catch (fallbackError) {
                  console.error('❌ Fallback also failed:', fallbackError);
                }
              }
            })();
          </script>
        </body>
        </html>
      `
      
      return new Response(html, {
        headers: { 
          'Content-Type': 'text/html',
          'X-Frame-Options': 'SAMEORIGIN',
          'Content-Security-Policy': "frame-ancestors 'self'"
        }
      })
    // } else {
    //   // Direct navigation - redirect to challenge processing
    //   const redirectUrl = `http://localhost:3000/challenge-processing?TransactionId=${transactionId}&MD=${md}&Status=${status || 'success'}`
    //   console.log('🔄 Redirecting to:', redirectUrl)
      
    //   return NextResponse.redirect(redirectUrl)
    // }
  } catch (error) {
    console.error('❌ Error in challenge-result:', error)
    
    // Return error response with postMessage
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Error</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 40px 20px;
            background: #f8d7da;
            color: #721c24;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .error-icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <h1>Authentication Failed</h1>
          <p>Something went wrong during authentication.</p>
        </div>
        
        <script>
          (function() {
            if (window !== window.top) {
              const messageData = {
                type: '3ds-challenge-complete',
                status: 'error',
                error: 'Authentication failed',
                timestamp: new Date().toISOString()
              };
              
              const targetOrigin = 'http://localhost:3000';
              
              try {
                window.parent.postMessage(messageData, targetOrigin);
                console.log('❌ Error message sent to parent');
              } catch (error) {
                console.error('❌ Error sending error message:', error);
                // Fallback
                window.parent.postMessage(messageData, '*');
              }
            }
          })();
        </script>
      </body>
      </html>
    `
    
    return new Response(errorHtml, {
      status: 400,
      headers: { 
        'Content-Type': 'text/html',
        'X-Frame-Options': 'SAMEORIGIN'
      }
    })
  }
}

// Handle GET requests (in case browser tries to verify the endpoint)
export async function GET() {
  return new Response('This endpoint only accepts POST requests', { status: 405 })
} 