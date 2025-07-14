# StockPilot Process Diagram

This document outlines the primary user workflows for the StockPilot inventory management system, separated by user role, using PlantUML syntax.

## Admin Workflow

```plantuml
@startuml
title Admin Workflow
start

:Login;

if (Select Admin Role) then (yes)
  repeat
    :View Inventory Dashboard;

    switch (Choose Action?)
    case (Manage Inventory)
      partition "Manage Inventory" {
        if (Add New Product?) then (yes)
          :Fill Form & Add Lots;
        elseif (Edit Existing Product?) then (yes)
          :Modify Details/Lots/Files;
        elseif (Delete Product?) then (yes)
          :Confirm Deletion;
        endif
      }
    case (Manage Requests)
      partition "Manage Requests" {
        :View Pending Requests;
        if (Fulfill Request?) then (yes)
          :Open Transaction Form;
          :Record Dispense;
          note right: Request Marked "Completed"
        else (no)
          :Reject Request;
          :Confirm Rejection;
          note right: Request Marked "Rejected"
        endif
      }
    case (Manage Transactions)
      partition "Manage Transactions" {
        if (View History?) then (yes)
          :View Transaction History;
        elseif (Create Manual Transaction?) then (yes)
          :Record Dispense;
        elseif (Delete Transaction?) then (yes)
          :Revert Stock Levels;
        endif
      }
    case (Data Portability)
       partition "Data Portability" {
        if (Import Products from CSV?) then (yes)
        elseif (Export Inventory to CSV?) then (yes)
        elseif (Export Transactions to CSV?) then (yes)
        endif
       }
    case (Logout)
      break
    endswitch
  repeat while (Action is not Logout)
else (no)
  stop
endif

:Logout;

stop
@enduml
```

## Staff Workflow

```plantuml
@startuml
title Staff Workflow
start

:Login;

if (Select Staff Role) then (yes)
  repeat
    :View Simplified Inventory List;

    switch (Choose Action?)
    case (Request a Product)
      :Click "Request Item" Button;
      :Fill Out Request Form;
      :Submit Form;
      note right: Request sent to Admin
    case (Logout)
      break
    endswitch
  repeat while (Action is not Logout)
else (no)
  stop
endif

:Logout;

stop
@enduml
```
