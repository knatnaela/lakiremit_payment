# Laki Remit Payment - Cybersource Integration

A secure, modern payment form built with Next.js, Tailwind CSS, and Cybersource Microform for remittance services.

## 🚀 Features

- **Secure Payment Processing**: Integration with Cybersource Microform for PCI-compliant card data handling
- **Modern UI/UX**: Beautiful, responsive design built with Tailwind CSS
- **Real-time Validation**: Client-side form validation with helpful error messages
- **Mobile Responsive**: Optimized for all device sizes
- **TypeScript**: Full type safety throughout the application
- **Loading States**: Intuitive loading indicators and payment status updates
- **Error Handling**: Comprehensive error handling with user-friendly messages

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form
- **Icons**: Lucide React
- **Notifications**: React Hot Toast
- **Payment**: Cybersource Microform SDK

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18+ and npm
- A Cybersource merchant account (for production)

## �� Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser** and navigate to `http://localhost:3000`

## 🔧 Configuration

### Cybersource Setup

The application currently uses a **mock implementation** for development. To integrate with actual Cybersource:

1. **Update API Routes**: Replace the mock implementations in:
   - `app/api/generate-token/route.ts` - Generate real JWT tokens
   - `app/api/process-payment/route.ts` - Process actual payments

2. **Environment Variables**: Create a `.env.local` file:
   ```env
   CYBERSOURCE_MERCHANT_ID=your_merchant_id
   CYBERSOURCE_KEY_ID=your_key_id
   CYBERSOURCE_SECRET_KEY=your_secret_key
   CYBERSOURCE_RUN_ENVIRONMENT=apitest
   ```

3. **Update Microform SDK URL**: In `app/layout.tsx`, change the script source for production

## 🏗️ Project Structure

```
laki_remit_payment/
├── app/
│   ├── api/
│   │   ├── generate-token/route.ts    # Microform token generation
│   │   └── process-payment/route.ts   # Payment processing
│   ├── globals.css                    # Global styles and Tailwind
│   ├── layout.tsx                     # Root layout with Cybersource SDK
│   └── page.tsx                       # Main page
├── components/
│   └── PaymentForm.tsx               # Main payment form component
├── types/
│   └── payment.ts                    # TypeScript type definitions
└── Configuration files...
```

## 🎯 Key Components

### PaymentForm Component

The main payment form includes:
- **Secure Card Fields**: Cybersource-hosted iframe fields for card number and CVV
- **Personal Information**: Name and email collection
- **Billing Address**: Country, city, address, and postal code
- **Amount Selection**: Multi-currency support
- **Real-time Validation**: Immediate feedback on form errors
- **Payment Status**: Loading, success, and error states

### Security Features

- **PCI Compliance**: Sensitive card data never touches your servers
- **Tokenization**: Card data is tokenized by Cybersource before submission
- **HTTPS Only**: Secure transmission of all data
- **Input Validation**: Both client and server-side validation
- **Error Handling**: Secure error messages that don't leak sensitive information

## 🔒 Security Best Practices

1. **Never handle raw card data** - Always use Cybersource Microform
2. **Use HTTPS** in production environments
3. **Validate all inputs** on both client and server sides
4. **Implement proper error handling** without exposing sensitive information
5. **Keep dependencies updated** for security patches
6. **Use environment variables** for sensitive configuration

## 📱 Mobile Responsiveness

The payment form is fully responsive and optimized for:
- **Desktop**: Full-width layout with side-by-side fields
- **Tablet**: Responsive grid that adapts to medium screens
- **Mobile**: Single-column layout with touch-friendly inputs

## 🎨 Customization

### Styling

The application uses Tailwind CSS with a custom theme. Key customizations:
- **Primary Colors**: Blue theme (`primary-500`, `primary-600`, etc.)
- **Form Components**: Reusable CSS classes in `globals.css`
- **Card Styling**: Modern card design with shadows and rounded corners

## 🧪 Testing

The application includes mock implementations for testing:
- **Token Generation**: Returns mock JWT tokens
- **Payment Processing**: Simulates payment success/failure (90% success rate)
- **Loading States**: Realistic delays to test UX

## 🚀 Deployment

### Build for Production

```bash
npm run build
npm start
```

### Environment Setup

For production deployment:
1. Set up proper environment variables
2. Configure Cybersource production credentials
3. Update SDK URLs to production endpoints
4. Implement proper error logging and monitoring

## 📄 API Reference

### POST /api/generate-token

Generates a Cybersource microform token for client-side initialization.

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "expiresAt": "2024-01-01T12:00:00Z"
}
```

### POST /api/process-payment

Processes a payment using tokenized card data.

**Request:**
```json
{
  "token": "card_token",
  "amount": 100.00,
  "currency": "USD",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "TXN-123456789",
  "message": "Payment processed successfully"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the [Cybersource Documentation](https://developer.cybersource.com/)
- Review the code comments and type definitions
- Open an issue in the repository

---

**Note**: This implementation includes mock APIs for development. Replace with actual Cybersource integration for production use. 