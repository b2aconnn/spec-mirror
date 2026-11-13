# Technical Design Document — 데이터 모델 · API

> [design.md](../design.md)로 돌아가기

## Data Models

### Domain Models

<convention의 구조대로 (예: DDD면 Aggregate · Value Object · Entity, 3 layer면 Entity)>

#### <Name>

```<언어>
<도메인 모델>
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
