# Admin Permission Matrix

Backend authorization is mandatory; hidden buttons are not security.

| Action | Member | Admin | Super-admin | Control |
| --- | --- | --- | --- | --- |
| Own data/orders/referrals | Yes | Yes | Yes | Ownership checks |
| View all members/networks/payments/orders | No | Yes | Yes | Read permission |
| Suspend/revoke sessions | No | Yes | Yes | Reason + audit |
| Approve/reject withdrawal | No | Yes | Yes | No self-approval; currently disabled |
| Manage products/packages | No | Assigned product permission | Yes | Audit changes |
| Manage order/refund status | No | Assigned order permission | Yes | Policy-gated |
| Change membership prices/rates | No | No | Yes | Versioned policy + audit |
| Correct referral/assign member | No | No | Yes | Approved policy + immutable audit |
| Create/promote admin | No | No | Yes | No self-promotion/MFA |
| Audit/security view | No | Assigned permission | Yes | Least privilege |
| Payment/system secrets | No | No | Restricted operator process | Never mobile client |

Require MFA for every admin/super-admin before launch. Provision the first super-admin only through the guarded backend process.
