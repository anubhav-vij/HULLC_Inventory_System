# StockPilot Process Diagram

This document outlines the primary user workflows for the StockPilot inventory management system, separated by user role.

## Admin Workflow

```mermaid
graph TD
    A[Start] --> B{Login};
    B -- Select Admin Role --> C[View Inventory Dashboard];
    C --> D{Manage Inventory};
    C --> E{Manage Requests};
    C --> F{Manage Transactions};
    C --> G{Data Portability};
    C --> H[Logout];

    subgraph Manage Inventory
        D --> D1[Add New Product];
        D1 -- Fill Form & Add Lots --> C;
        D --> D2[Edit Existing Product];
        D2 -- Modify Details/Lots/Files --> C;
        D --> D3[Delete Product];
        D3 -- Confirm Deletion --> C;
    end

    subgraph Manage Requests
        E --> E1[View Pending Requests];
        E1 --> E2{Fulfill Request?};
        E2 -- Yes --> E3[Open Transaction Form];
        E3 -- Record Dispense --> E4[Request Marked "Completed"];
        E4 --> C;
        E2 -- No --> E5[Reject Request];
        E5 -- Confirm Rejection --> E6[Request Marked "Rejected"];
        E6 --> C;
    end
    
    subgraph Manage Transactions
        F --> F1[View Transaction History];
        F --> F2[Create Manual Transaction];
        F2 -- Record Dispense --> C;
        F --> F3[Delete Transaction];
        F3 -- Revert Stock Levels --> C;
    end

    subgraph Data Portability
        G --> G1[Import Products from CSV];
        G1 --> C;
        G --> G2[Export Inventory to CSV];
        G --> G3[Export Transactions to CSV];
    end
```

## Staff Workflow

```mermaid
graph TD
    A[Start] --> B{Login};
    B -- Select Staff Role --> C[View Simplified Inventory List];
    C --> D{Request a Product};
    C --> H[Logout];

    subgraph Request a Product
      D --> D1[Click "Request Item" Button];
      D1 --> D2[Fill Out Request Form];
      D2 -- Submit Form --> D3[Request sent to Admin];
      D3 --> C;
    end
```
