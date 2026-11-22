# CI/CD Pipeline Demo — GitHub Actions → S3 → EC2

A small Node.js/Express web app with a GitHub Actions pipeline. Every push to `main` goes through:

```
Code change → git push → security scans + unit tests → build zip → S3 → deploy to EC2 → verify production
```

## Pipeline (`.github/workflows/ci-cd.yml`)

| Job | What it does | Fails the pipeline when |
|---|---|---|
| **Secret scan** | Gitleaks over the full git history | a credential is committed |
| **Dependency scan** | `npm audit --audit-level=high` | a high/critical CVE is in the dependencies |
| **SAST** | GitHub CodeQL (`security-and-quality`) | CodeQL errors (findings show in the Security tab) |
| **Unit tests** | Jest + Supertest, 80% line-coverage gate | any test fails or coverage drops |
| **Build** | `npm ci --omit=dev`, stamps `build-info.json`, zips to `build-v1.0.<run>.zip` | — |
| **Upload to S3** | pushes the zip to `s3://<bucket>/releases/`, then updates `releases/latest.json` | — |
| **Deploy** | SSM Run Command on the EC2 instance: pull `latest.json` → download zip → new release dir → switch symlink → restart → health check, **rolling back automatically** if it fails | the server health check fails |
| **Verify** | curls the public `/health` and checks it reports the version just built | production isn't serving the new version |

Pull requests run the scans, tests and build. Only pushes to `main` upload and deploy.

AWS access uses **GitHub OIDC**, so no AWS access keys are stored in GitHub. The server has no SSH port open, and deploys go through SSM.

## Architecture

```
GitHub push ──► GitHub Actions ──(OIDC)──► S3: releases/build-vX.zip + latest.json
                                   │
                                   └─ssm:SendCommand──► EC2 (Amazon Linux 2023)
                                                          deploy.sh pulls latest.json + zip from S3
                                                          /opt/app/releases/<ver> ← /opt/app/current
                                                          systemd "app" on port 80
```

## One-time setup

You need an AWS account (use a personal or sandbox account), AWS CLI v2 and `gh`.

```bash
# 1. Create the GitHub repo and push
gh repo create cicd-pipeline-demo --public --source . --push

# 2. Provision AWS (S3 bucket, EC2, IAM roles, OIDC provider). Takes about 3 minutes.
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
aws cloudformation deploy --stack-name devops-assignment --template-file infra/stack.yml \
  --capabilities CAPABILITY_IAM --region ap-southeast-2 \
  --parameter-overrides GitHubRepo=$REPO CreateOidcProvider=false \
      GitHubSubjectPrefix=$(gh api repos/$REPO/actions/oidc/customization/sub --jq '.sub_claim_prefix // ""')
#    (use CreateOidcProvider=true if the account does not have the GitHub OIDC provider yet)

# 3. Wire the stack outputs into GitHub repo variables
out() { aws cloudformation describe-stacks --stack-name devops-assignment --region ap-southeast-2 \
          --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
gh variable set AWS_REGION      --body ap-southeast-2
gh variable set AWS_ROLE_ARN    --body "$(out DeployRoleArn)"
gh variable set S3_BUCKET       --body "$(out ArtifactBucketName)"
gh variable set EC2_INSTANCE_ID --body "$(out InstanceId)"
gh variable set APP_URL         --body "$(out AppUrl)"

# 4. Run the pipeline for the first time
gh workflow run ci-cd.yml && gh run watch
```

## Run locally

```bash
npm install
npm test
npm start   # http://localhost:3000
```

## 2-minute demo script

| Time | Show |
|---|---|
| 0:00 | Browser on `APP_URL`: current headline and version badge |
| 0:10 | Edit `HEADLINE` in `src/config.js` (e.g. `'Hello from v2 — deployed by CI/CD!'`) |
| 0:20 | `git commit -am "Change headline" && git push` |
| 0:25 | GitHub → Actions: the run starts. Point at the job graph: scans ∥ tests → build → S3 → deploy → verify |
| 0:40 | Open **Unit tests**: Jest output, all passing *(fast-forward)* |
| 0:55 | Open **Build**: `build-v1.0.N.zip` created |
| 1:05 | Open **Upload to S3**, then the S3 console: `releases/build-v1.0.N.zip` + `latest.json` |
| 1:20 | Open **Deploy**: SSM output "Deploying 1.0.N … Health check passed" |
| 1:35 | **Verify** is green. Refresh the browser: new headline, new version, new commit SHA |
| 1:45 | *(optional)* Security tab with CodeQL results, or a deliberately broken test failing the run |

To show the "tests gate the deploy" behaviour, change an expected value in `tests/calculator.test.js` and push. The run stops at **Unit tests**, and the deploy jobs are skipped.

## Teardown

```bash
aws s3 rm s3://$(out ArtifactBucketName) --recursive   # versioned bucket: also empty old versions in the console
aws cloudformation delete-stack --stack-name devops-assignment --region ap-southeast-2
```
