# **App Name**: Creative Dispatch

## Core Features:

- Order Creation Form: Administrator can create new orders with details like object name, work description, due date, and assign an installer. Supports drag-and-drop for image uploads, file selection, and direct paste from clipboard. All order data is persisted locally using localStorage.
- Order Listing & Editing: Display a dynamic list of orders in a clean, card-based or tabular format. Each order includes an 'Edit' button to modify its details via a modal interface. Data is persisted using localStorage.
- Order Status Management: Ability to change an order's status between 'В работе' (In Progress) and 'Завершен' (Completed). The status changes are saved to localStorage.
- AI Visual Work Estimator: Utilize generative AI as a tool to analyze uploaded photos and work descriptions for new orders. The AI provides suggestions for potential complexities, required tools, or estimated work duration.
- Toast Notification System: Implement a subtle, non-intrusive push notification (Toast) system within the interface to inform administrators and installers about new order creation or updates.

## Style Guidelines:

- The application features a sophisticated dark theme, embodying a modern and professional aesthetic suitable for an advertising agency. The primary color, a rich and deep violet (#660099), is used for interactive elements and primary actions. The background color is a very dark, slightly desaturated violet (#1C141F), providing a contemporary and clean base. A contrasting accent color, a bright yet refined blue (#A6A6FF), is employed for highlights and secondary interactive components to ensure visual distinction.
- For headlines and prominent text, the 'Space Grotesk' (sans-serif) font will be used, offering a modern, tech-inspired feel. Body text and longer descriptions will use 'Inter' (sans-serif) for its excellent readability and neutral, objective appearance.
- Clean, minimalistic line icons will be used throughout the application to maintain a modern and uncluttered interface. Icons will be easily recognizable for actions like editing, uploading, status changes, and notifications.
- The layout is responsive and mobile-first, ensuring optimal usability on devices ranging from desktops to smartphones. Orders are presented in a clear, card-based format for easy viewing, with ample use of white space to enhance readability and a clean aesthetic. Key functionalities like order creation and editing will utilize well-designed modal windows for focused interactions.
- Subtle and fluid animations will be incorporated for state changes, such as the opening and closing of modals, form submissions, and the appearance of toast notifications. Hover effects on interactive elements will provide visual feedback without being distracting.