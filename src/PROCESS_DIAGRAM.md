# StockPilot Process Diagram

This document outlines the primary user workflows for the StockPilot inventory management system, separated by user role, using PlantUML syntax.

## Admin Workflow

```plantuml
@startuml
title Admin Workflow
start

'The user is assumed to be logged in as an Admin.

:View Inventory Dashboard;

if (Manage Inventory?) then (yes)
  partition "Manage Inventory" {
    :Add/Edit/Delete Product;
  }
elseif (Manage Requests?) then (yes)
  partition "Manage Requests" {
    :View & Fulfill/Reject Requests;
  }
elseif (Manage Transactions?) then (yes)
  partition "Manage Transactions" {
    :View History or Create/Delete Transactions;
  }
elseif (Data Portability?) then (yes)
   partition "Data Portability" {
    :Import or Export CSV Data;
   }
endif

-> View Inventory Dashboard;

stop
@enduml
```

## Staff Workflow

```plantuml
@startuml
title Staff Workflow
start

'The user is assumed to be logged in as Staff.

:View Simplified Inventory List;

if (Request a Product?) then (yes)
  :Click "Request Item" Button;
  :Fill Out & Submit Form;
  note right: Request sent to Admin
endif

-> View Simplified Inventory List;

stop
@enduml
```
