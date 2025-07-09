# Product Requirements Document: StockPilot Inventory Management System

**Version:** 1.0
**Status:** Live

---

### 1. Overview

StockPilot is a specialized web-based inventory management system designed to provide streamlined tracking of products and their associated lots. The application is built around a role-based access control system, offering distinct functionalities for administrators who manage the inventory and staff members who request materials. Key features include detailed lot-level tracking, visual status alerts for stock levels and expirations, a formal product request workflow, and robust data management capabilities for administrators.

### 2. User Roles & Permissions

The application defines two user roles to ensure data security and delegate responsibilities effectively.

*   **2.1. Admin:**
    *   **Persona:** An inventory manager or lab supervisor responsible for maintaining accurate stock records, fulfilling requests, and overseeing the entire inventory lifecycle.
    *   **Permissions:** Has full, unrestricted access to all application features. This includes creating, reading, updating, and deleting all products, lots, and transactions. The Admin is the only user who can manage product requests and perform data import/export operations.

*   **2.2. Staff:**
    *   **Persona:** A lab technician, researcher, or general staff member who needs to consume inventory for their work.
    *   **Permissions:** Has restricted, view-only access to a simplified product list. The primary function of the Staff role is to submit formal requests for products. They cannot see sensitive data such as stock quantities, storage locations, or transaction history.

### 3. Detailed Feature Specifications

#### 3.1. Core Application & UI

*   **Role-Based Login:** The application entry point is a simple login screen where a user selects their role ("Admin" or "Staff") to begin a session.
*   **Data Persistence:** All inventory, transaction, and request data is saved in the browser's local storage, ensuring information persists between user sessions.
*   **Dynamic Interface:** The user interface is role-aware. Tabs, buttons, and table columns are dynamically hidden or shown based on the logged-in user's permissions.

#### 3.2. Inventory Dashboard

This is the primary interface for viewing product information, accessible via the "Inventory" tab.

*   **Product Table:** A comprehensive table lists all products.
    *   **Admin View:** Includes columns for `Product`, `Vendor`, `Vendor Part #`, `Total Quantity`, `Storage Location`, and `Actions`.
    *   **Staff View:** A simplified view showing only `Product`, `Vendor`, `Vendor Part #`, and a `Request` button.
*   **Visual Status Indicators:** Product rows are color-coded for immediate status identification:
    *   **Red Background:** The product has a total quantity of zero.
    *   **Orange Background:** The product has at least one lot that has passed its expiration date.
    *   **Reorder Alert:** A warning triangle icon appears next to the quantity if it is at or below the set reorder threshold (Admin view only).
*   **Collapsible Lot Details (Admin-only):** Admins can expand any product row to view a detailed breakdown of its constituent lots, including `Lot #`, `Quantity`, `Receipt Date`, `Expiration Date`, and `Storage Location`. This feature is disabled for Staff.

#### 3.3. Product Lifecycle Management (Admin-only)

*   **Add Product:** Admins can add new products through a form that captures all necessary details and requires the creation of at least one initial lot.
*   **Edit Product:** Admins can modify all details of an existing product and manage its lots (add, edit, remove) via a scrollable form.
*   **Delete Product:** Admins can permanently delete a product from the system after confirming the action in a dialog box.

#### 3.4. Product Request Workflow

This workflow formalizes how staff members obtain materials.

*   **Step 1: Staff Submits Request:**
    *   A Staff user clicks the "Request" button on any product in the inventory dashboard, regardless of its stock level or expiration status.
    *   A **Product Request Form** opens, capturing:
        *   Requester Name and NIH Email Address
        *   Department and Project (from predefined dropdown lists)
        *   Quantity needed
        *   Written justification for the request
        *   A mandatory checkbox confirming they have read "SOP-30037.01".
*   **Step 2: Request Appears for Admin:**
    *   The submitted request appears in a new **"Product Requests"** tab, visible only to Admins.
    *   The request has a default status of "Pending", indicated by a badge.

#### 3.5. Request Fulfillment & Transaction Management (Admin-only)

*   **"Product Requests" Tab:** This tab provides Admins with a table of all submitted requests, showing requester details, product information, and status.
*   **Fulfillment:**
    *   An Admin can click the **"Fulfill"** button on a pending request.
    *   This action opens the **New Transaction** form, pre-populating the relevant product. The Admin enters the quantity dispensed from one or more lots.
    *   Upon saving the transaction, the corresponding product request is **automatically marked as "Completed"**.
*   **Rejection:** An Admin can click **"Reject"** on a request, which, after confirmation, marks its status as "Rejected".
*   **Transaction History:**
    *   All fulfillment and manual dispense events are logged in the **"Transactions"** tab.
    *   Admins can delete erroneous transactions. This action reverses the stock movement, returning the dispensed quantity to the correct inventory lots.
    *   To ensure a clear audit trail, transactions cannot be edited.

#### 3.6. Data Portability (Admin-only)

*   **CSV Import:** Admins can use a CSV file to bulk-add or update products and their lots.
*   **CSV Export:** Dedicated "Export CSV" buttons on the "Inventory" and "Transactions" tabs allow Admins to download complete datasets for offline analysis or record-keeping.

#### 3.7. Backend Capabilities (Non-User-Facing)

*   **AI-Powered Expiration Prediction:** The system's backend includes a Genkit AI flow (`predict-expiration-dates`) capable of predicting product expiration dates based on product data. This AI feature is not currently integrated into the front-end interface.
