# Monte Deployment Architecture

## Table of Contents
1. [Containerization Strategy](#containerization-strategy)
2. [Orchestration](#orchestration)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Environment Management](#environment-management)
5. [Monitoring and Logging](#monitoring-and-logging)
6. [Disaster Recovery](#disaster-recovery)

## Containerization Strategy

### Docker Images

#### Backend Service

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/main.js"]
```

#### Frontend Service

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Multi-Stage Builds

**Benefits:**
- Smaller final image size
- Separation of build and runtime dependencies
- Faster deployment
- Reduced attack surface

### Image Optimization

**Strategies:**
- Use Alpine Linux base images
- Minimize layers in Dockerfile
- Remove unnecessary dependencies
- Use .dockerignore to exclude files

**.dockerignore:**
```
node_modules
npm-debug.log
.git
.env
dist
*.log
```

### Image Registry

**Registry Setup:**
```bash
# Build and tag image
docker build -t monte/backend:latest .

# Tag for registry
docker tag monte/backend:latest registry.monte.io/monte/backend:latest

# Push to registry
docker push registry.monte.io/monte/backend:latest
```

## Orchestration

### Kubernetes Deployment

#### Namespace Configuration

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monte
  labels:
    name: monte
    environment: production
```

#### Backend Deployment

```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: monte
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: backend
        version: v1
    spec:
      containers:
      - name: backend
        image: registry.monte.io/monte/backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_HOST
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: host
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: host
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Service Configuration

```yaml
# backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: monte
spec:
  selector:
    app: backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

#### Ingress Configuration

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: monte-ingress
  namespace: monte
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - api.monte.io
    secretName: monte-tls
  rules:
  - host: api.monte.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 80
```

### Horizontal Pod Autoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: monte
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### ConfigMaps

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: monte
data:
  NODE_ENV: "production"
  API_PREFIX: "api/v1"
  STELLAR_NETWORK: "mainnet"
  STELLAR_HORIZON_URL: "https://horizon.stellar.org"
  SOROBAN_RPC_URL: "https://soroban.stellar.org"
```

### Secrets

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
  namespace: monte
type: Opaque
stringData:
  host: "postgres-postgresql.postgres"
  port: "5432"
  user: "postgres"
  password: "your-password"
  database: "monte"
```

### StatefulSets for Database

```yaml
# postgres-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: monte
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:14
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: "monte"
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: registry.monte.io
  IMAGE_NAME: monte/backend

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: monte_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: backend/package-lock.json
    
    - name: Install dependencies
      working-directory: ./backend
      run: npm ci
    
    - name: Run linter
      working-directory: ./backend
      run: npm run lint
    
    - name: Run tests
      working-directory: ./backend
      run: npm test
    
    - name: Run e2e tests
      working-directory: ./backend
      run: npm run test:e2e
      env:
        DATABASE_HOST: localhost
        DATABASE_PORT: 5432
        DATABASE_USER: postgres
        DATABASE_PASSWORD: postgres
        DATABASE_NAME: monte_test
        REDIS_HOST: localhost
        REDIS_PORT: 6379

  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Log in to registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ secrets.REGISTRY_USERNAME }}
        password: ${{ secrets.REGISTRY_PASSWORD }}
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: ./backend
        push: true
        tags: |
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
        cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache
        cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache,mode=max

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure kubectl
      uses: azure/k8s-set-context@v3
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.KUBE_CONFIG_STAGING }}
    
    - name: Deploy to staging
      run: |
        kubectl set image deployment/backend backend=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} -n monte-staging
        kubectl rollout status deployment/backend -n monte-staging
    
    - name: Run smoke tests
      run: |
        kubectl run smoke-test --image=curlimages/curl --rm -n monte-staging --restart=Never -- \
          curl --fail http://backend-service.monte-staging.svc.cluster.local/health

  deploy-production:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure kubectl
      uses: azure/k8s-set-context@v3
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.KUBE_CONFIG_PROD }}
    
    - name: Deploy to production
      run: |
        kubectl set image deployment/backend backend=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} -n monte
        kubectl rollout status deployment/backend -n monte
    
    - name: Verify deployment
      run: |
        kubectl run smoke-test --image=curlimages/curl --rm -n monte --restart=Never -- \
          curl --fail http://backend-service.monte.svc.cluster.local/health
    
    - name: Notify team
      uses: slackapi/slack-github-action@v1
      with:
        payload: |
          {
            "text": "Production deployment completed: ${{ github.sha }}"
          }
```

### Database Migration in CI/CD

```yaml
# migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: migration-job
  namespace: monte
spec:
  template:
    spec:
      containers:
      - name: migration
        image: registry.monte.io/monte/backend:latest
        command: ["npm", "run", "migration:run"]
        env:
        - name: DATABASE_HOST
          valueFrom:
            configMapKeyRef:
              name: db-config
              key: host
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
      restartPolicy: OnFailure
```

## Environment Management

### Environment Strategy

**Environments:**
- **Development**: Local development
- **Staging**: Pre-production testing
- **Production**: Live production

### Environment Configuration

#### Development

**Configuration:**
- Local PostgreSQL
- Local Redis
- Stellar testnet
- Mock external services

**Deployment:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

#### Staging

**Configuration:**
- Cloud PostgreSQL (RDS)
- Cloud Redis (ElastiCache)
- Stellar testnet
- Real external services (sandbox)

**Deployment:**
```bash
kubectl apply -f k8s/staging/
```

#### Production

**Configuration:**
- Cloud PostgreSQL (RDS Multi-AZ)
- Cloud Redis (ElastiCache Cluster)
- Stellar mainnet
- Real external services

**Deployment:**
```bash
kubectl apply -f k8s/production/
```

### Configuration Management

#### Helm Charts

```yaml
# Chart.yaml
apiVersion: v2
name: monte
description: Monte payment infrastructure
type: application
version: 1.0.0
appVersion: "1.0.0"
```

```yaml
# values.yaml
replicaCount: 3

image:
  repository: registry.monte.io/monte/backend
  pullPolicy: IfNotPresent
  tag: "latest"

database:
  host: "postgres-postgresql.postgres"
  port: 5432
  name: monte
  user: postgres
  existingSecret: db-secret

redis:
  host: "redis-master.redis"
  port: 6379

stellar:
  network: mainnet
  horizonUrl: https://horizon.stellar.org
  sorobanRpcUrl: https://soroban.stellar.org

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### Feature Flags

```typescript
// feature-flag.service.ts
@Injectable()
export class FeatureFlagService {
  constructor(
    @InjectRepository(FeatureFlag)
    private repository: Repository<FeatureFlag>,
  ) {}

  async isEnabled(flagName: string): Promise<boolean> {
    const flag = await this.repository.findOne({ where: { name: flagName } });
    return flag?.enabled || false;
  }

  async setFlag(flagName: string, enabled: boolean): Promise<void> {
    await this.repository.save({ name: flagName, enabled });
  }
}
```

## Monitoring and Logging

### Monitoring Stack

#### Prometheus Setup

```yaml
# prometheus-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: config
          mountPath: /etc/prometheus
        - name: storage
          mountPath: /prometheus
      volumes:
      - name: config
        configMap:
          name: prometheus-config
      - name: storage
        persistentVolumeClaim:
          claimName: prometheus-storage
```

#### Grafana Setup

```yaml
# grafana-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:latest
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grafana-secret
              key: admin-password
        volumeMounts:
        - name: storage
          mountPath: /var/lib/grafana
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: grafana-storage
```

### Logging Stack

#### Loki Setup

```yaml
# loki-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loki
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: loki
  template:
    metadata:
      labels:
        app: loki
    spec:
      containers:
      - name: loki
        image: grafana/loki:latest
        ports:
        - containerPort: 3100
        args:
        - "-config.file=/etc/loki/local-config.yaml"
        volumeMounts:
        - name: config
          mountPath: /etc/loki
        - name: storage
          mountPath: /loki
      volumes:
      - name: config
        configMap:
          name: loki-config
      - name: storage
        persistentVolumeClaim:
          claimName: loki-storage
```

#### Promtail Setup

```yaml
# promtail-daemonset.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: promtail
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: promtail
  template:
    metadata:
      labels:
        app: promtail
    spec:
      containers:
      - name: promtail
        image: grafana/promtail:latest
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: config
          mountPath: /etc/promtail
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: config
        configMap:
          name: promtail-config
```

### Application Metrics

```typescript
// metrics.service.ts
import { Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly httpRequestsTotal: Counter;
  private readonly httpRequestDuration: Histogram;
  private readonly activeConnections: Gauge;

  constructor() {
    this.httpRequestsTotal = new Counter({
      name: 'monte_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    });

    this.httpRequestDuration = new Histogram({
      name: 'monte_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.1, 0.5, 1, 2, 5],
    });

    this.activeConnections = new Gauge({
      name: 'monte_active_connections',
      help: 'Number of active connections',
    });
  }

  recordRequest(method: string, route: string, status: number, duration: number): void {
    this.httpRequestsTotal.inc({ method, route, status });
    this.httpRequestDuration.observe({ method, route }, duration);
  }

  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }
}
```

### Distributed Tracing

```typescript
// tracing.service.ts
import { trace } from '@opentelemetry/api';

@Injectable()
export class TracingService {
  private tracer = trace.getTracer('monte-backend');

  async traceOperation<T>(
    name: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const span = this.tracer.startSpan(name);

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}
```

## Disaster Recovery

### Backup Strategy

#### Database Backups

```yaml
# backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: monte
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:14
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME | gzip > /backup/backup_$(date +%Y%m%d_%H%M%S).sql.gz
              aws s3 cp /backup/backup_*.sql.gz s3://monte-backups/database/
            env:
            - name: DATABASE_HOST
              valueFrom:
                configMapKeyRef:
                  name: db-config
                  key: host
            - name: DATABASE_USER
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: user
            - name: DATABASE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: password
            - name: DATABASE_NAME
              valueFrom:
                configMapKeyRef:
                  name: db-config
                  key: name
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: aws-secret
                  key: access-key-id
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: aws-secret
                  key: secret-access-key
            volumeMounts:
            - name: backup
              mountPath: /backup
          volumes:
          - name: backup
            persistentVolumeClaim:
              claimName: backup-storage
          restartPolicy: OnFailure
```

#### Configuration Backups

```yaml
# config-backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: config-backup
  namespace: monte
spec:
  schedule: "0 3 * * *"  # Daily at 3 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: bitnami/kubectl:latest
            command:
            - /bin/sh
            - -c
            - |
              kubectl get configmaps -n monte -o yaml > /backup/configmaps_$(date +%Y%m%d_%H%M%S).yaml
              kubectl get secrets -n monte -o yaml > /backup/secrets_$(date +%Y%m%d_%H%M%S).yaml
              aws s3 cp /backup/* s3://monte-backups/config/
            env:
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: aws-secret
                  key: access-key-id
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: aws-secret
                  key: secret-access-key
            volumeMounts:
            - name: backup
              mountPath: /backup
          volumes:
          - name: backup
            persistentVolumeClaim:
              claimName: backup-storage
          restartPolicy: OnFailure
```

### Recovery Procedures

#### Database Recovery

```bash
# Restore from backup
aws s3 cp s3://monte-backups/database/backup_20240101_020000.sql.gz /tmp/
gunzip /tmp/backup_20240101_020000.sql.gz
psql -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME < /tmp/backup_20240101_020000.sql
```

#### Point-in-Time Recovery

```bash
# Configure recovery
echo "restore_command = 'cp /var/lib/postgresql/archive/%f %p'" >> postgresql.conf
echo "recovery_target_time = '2024-01-01 12:00:00'" >> postgresql.conf

# Create recovery signal
touch /var/lib/postgresql/main/recovery.signal

# Restart PostgreSQL
kubectl rollout restart statefulset/postgres -n monte
```

### High Availability

#### Multi-Region Deployment

```yaml
# Multi-region setup
regions:
  - us-east-1
  - us-west-2
  - eu-west-1

# DNS routing
apiVersion: externaldns.k8s.io/v1alpha1
kind: DNSEndpoint
metadata:
  name: monte-api
spec:
  endpoints:
  - DNSName: api.monte.io
    recordTTL: 60
    recordType: A
    targets:
    - us-east-1-lb.us-east-1.elb.amazonaws.com
    - us-west-2-lb.us-west-2.elb.amazonaws.com
    - eu-west-1-lb.eu-west-1.elb.amazonaws.com
```

#### Database Replication

```yaml
# PostgreSQL replication
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-replica
  namespace: monte
spec:
  replicas: 2
  serviceName: postgres-replica
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:14
        env:
        - name: POSTGRES_REPLICATION_MODE
          value: replica
        - name: POSTGRES_MASTER_HOST
          value: postgres-0.postgres
        - name: POSTGRES_MASTER_PORT
          value: "5432"
        - name: POSTGRES_REPLICATION_USER
          value: replicator
        - name: POSTGRES_REPLICATION_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: replication-password
```

### Failover Procedures

#### Service Failover

```bash
# Check pod status
kubectl get pods -n monte

# Delete failing pod
kubectl delete pod backend-xxxxx -n monte

# Verify new pod is running
kubectl get pods -n monte -w
```

#### Database Failover

```bash
# Promote replica to master
kubectl exec -it postgres-replica-0 -n monte -- pg_ctl promote

# Update connection strings
kubectl patch configmap db-config -n monte --type='json' \
  --patch='[{"op": "replace", "path": "/data/host", "value":"postgres-replica-0.postgres"}]'
```

## Support

For deployment architecture questions, contact:
- **DevOps Team**: devops@monte.io
- **Infrastructure Team**: infra@monte.io
- **Slack**: #monte-deployment
