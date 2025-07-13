import { type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const transactionId = formData.get('TransactionId')
    const response = formData.get('Response')
    const md = formData.get('MD')
    const status = formData.get('Status')

      const baseUrl = 'http://localhost:3000'
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>3D Secure Authentication Complete</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
          <script>
            tailwind.config = {
              theme: {
                extend: {
                  colors: {
                    primary: {
                      50: '#eff6ff',
                      500: '#3b82f6',
                      600: '#2563eb',
                      700: '#1d4ed8',
                    },
                    success: '#10b981',
                    error: '#ef4444',
                  }
                }
              }
            }
          </script>
          <style>
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            .animate-spin {
              animation: spin 1s linear infinite;
            }
          </style>
        </head>
        <body class="bg-gray-50 font-sans antialiased">
          <div class="min-h-screen flex items-center justify-center p-4">
            <div class="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md w-full">
              <div class="text-center">
                <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mb-4">
                  <svg class="h-8 w-8 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                </div>
                <h2 class="text-2xl font-bold text-gray-900 mb-2">Verifying Payment</h2>
                <p class="text-gray-600 mb-4">
                  Please wait while we verify your payment with your bank...
                </p>
                <div class="flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <svg class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  <span>Verifying with your bank...</span>
                </div>
              </div>
            </div>
          </div>
          
          <script>
            (function() {
              // Security: Verify we're in an iframe
              if (window === window.top) {
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
                
                // Optional: Show success message briefly before closing
                setTimeout(() => {
                  // You could close the iframe here if needed
                  // window.parent.postMessage({ type: 'close-iframe' }, targetOrigin);
                }, 2000);
                
              } catch (error) {
                // Fallback: Try with '*' if specific origin fails
                try {
                  window.parent.postMessage(messageData, '*');
                } catch (fallbackError) {
                  // Fallback also failed
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
    
  } catch (error) {
    // Error in challenge-result
    
    // Return error response with postMessage
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Error</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: {
                    50: '#eff6ff',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                  },
                  success: '#10b981',
                  error: '#ef4444',
                }
              }
            }
          }
        </script>
      </head>
      <body class="bg-gray-50 font-sans antialiased">
        <div class="min-h-screen flex items-center justify-center p-4">
          <div class="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md w-full">
            <div class="text-center">
              <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
                <svg class="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
              <h2 class="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
              <p class="text-gray-600 mb-4">
                Something went wrong during authentication. Please try again.
              </p>
            </div>
          </div>
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
              } catch (error) {
                // Error sending error message
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