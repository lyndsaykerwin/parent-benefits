# Zetaris on AWS: setup notes

Keep this file. You need these names to delete everything after the hackathon, or AWS keeps spending your credits.

## What exists so far (Oct 22, 2026)

| Thing | Value |
|---|---|
| AWS region | US West (N. California), `us-west-1` |
| CloudFormation stack name | `zetaris-AWS-hobby-account-ec2df81e` |
| Zetaris Cloud AWS account status | Verified |
| Cluster name | `baby-benefits` (confirm in Zetaris Cloud if you named it differently) |
| Cluster status | Active; connected from the Mac and sample query passed (Oct 22, 8:05pm) |
| Gateway sign-in | https://new-ui.2c5c244a-1087-41b5-a9dc-9e887e5645fa.cloud.zetaris.com/login |
| JDBC endpoint | `jdbc:hive2://jdbc.2c5c244a-1087-41b5-a9dc-9e887e5645fa.cloud.zetaris.com:10000/default;ssl=true` |
| Organisation ID | 1 |
| API key | Stored only in `setup/zetaris-getting-started/.env.local` (private, never uploaded) |
| Cluster size | Mini (2 computers, 4 processors total) |

A "stack" is the bundle of AWS pieces (network, storage, permissions) Zetaris set up in your account.
A "cluster" is the group of rented computers that actually runs Zetaris.

## Teardown order (after the hackathon, Oct 27 or later)

1. Zetaris Cloud → Compute → Clusters → your cluster → Delete (type the cluster name). Wait about 15 minutes until it says Deleted.
2. Zetaris Cloud → Compute → Credentials → delete icon → Open in AWS CloudFormation → Delete stack `zetaris-AWS-hobby-account-ec2df81e` in `us-west-1`. Wait for DELETE_COMPLETE.
3. Back in Zetaris, click Mark Deleted.
3b. Delete the API key: Gateway → Management → API Tokens. (It was shared in a chat, so retire it.)
4. Optional: leftover storage (EFS and an S3 bucket) can keep charging small amounts. Review and delete in AWS.

Source: Zetaris "Managed AWS cluster" guide, github.com/zetaris/getting-started (updated Oct 20, 2026).
