# Technical Design Document — 데이터 모델 · API

> [design.md](../design.md)로 돌아가기

## Data Models

### Aggregates

<설계 규모 작음이면 "해당 없음 — 설계 규모 작음: <이유>">

| Aggregate | Root | 함께 묶이는 것 | 지키는 규칙 |
|---|---|---|---|
| <이름> | `<Root 엔티티>` | <엔티티 · Value Object> | Requirements <N.M> |

### Value Objects

<규칙이나 계산이 있는 값. 없으면 "해당 없음 — <이유>">

### Domain Entities

#### <Entity> Entity

```<언어>
<엔티티>
```

### DTOs (Data Transfer Objects)

#### <Name> DTO

```<언어>
<DTO>
```

### Enums

```<언어>
<상태 enum>
```

### 도메인 용어 ↔ 코드

| 도메인 용어 | 코드 |
|---|---|
| <Glossary 용어> | `<코드 이름>` |

### API Endpoints

#### 1. <유스케이스>

```http
<요청 · 응답 예시>
```

### Database Schema (<DB>)

```sql
<DDL>
```
