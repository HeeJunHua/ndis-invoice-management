# NDIS Invoice Management System

A comprehensive system for managing NDIS participants, providers, and the invoicing process, featuring AI-powered invoice extraction and strict rate set validation.

## 🚀 Setup Instructions

### Prerequisites
- **Node.js**: LTS version recommended.
- **PostgreSQL**: Version 15+ (can be run via Docker).
- **MinIO**: For PDF storage (used by the AI invoice upload feature).

### Installation
1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file in the root directory with the following variables:
   ```env
   DATABASE_URL=postgres://user:password@localhost:5432/ndis_db
   JWT_SECRET=your_super_secret_jwt_key
   MINIO_ENDPOINT=localhost:9000
   MINIO_ACCESS_KEY=minioadmin
   MINIO_SECRET_KEY=minioadmin
   OPENROUTER_API_KEY=your_api_key
   ```

3. **Database Setup**:
   Run the migrations to create the schema and the seed script to populate initial data:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Run the Application**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## 🧠 Technical & Business Assumptions
- **Soft Deletion**: All primary entities (Clients, Providers, Invoices, Rate Sets) use a `deleted_at` timestamp. Records are never hard-deleted to maintain audit trails.
- **Backend as Source of Truth**: Rate sets, category mappings, and max rates are derived server-side based on the service date range. Client-provided rates are accepted but validated against the matched rate set's `max_rate`.
- **AI Extraction Pipeline**: The invoice upload process follows a Store $\rightarrow$ Extract $\rightarrow$ Map $\rightarrow$ Draft flow. If any mapping fails (e.g., unknown client), the invoice is marked as `needs_review`.
- **Financial Precision**: Used `bignumber.js` for all amount calculations to avoid floating-point precision errors.

## 🏗️ Architecture Trade-offs
- **Separation of Concerns**: Implemented a strict **API $\rightarrow$ Service $\rightarrow$ Repository** architecture. 
  - **API Routes**: Handle HTTP requests, authentication, and input parsing.
  - **Service Layer**: Centralizes business logic, complex validation, and transaction orchestration.
  - **Repositories**: Encapsulate raw Kysely DB queries, ensuring all reads filter out soft-deleted records.
- **Performance vs. Complexity**: used denormalized queries (joins) in `invoiceRepository.listForDisplay` to avoid N+1 query problems in the main invoice table, trading off slight query complexity for significantly better UI performance.
- **UI vs. Logic**: Prioritized the correctness of the pricing engine and validation rules over advanced UI polish.

## 🛠️ Incomplete / Omitted Features
- **Advanced RBAC UI**: While the backend supports granular permissions, the UI primarily focuses on role-based access. A full permission-matrix editor was omitted.
- **AI Human-in-the-loop**: The "Needs Review" state is implemented, but a dedicated "Correction UI" for AI-extracted fields is a simplified version of what would be required for a production system.

## ⚠️ Known Limitations & Future Improvements
- **Rate Set Overlap**: The current implementation assumes a single active rate set for any given date range. Complex overlapping or versioned rate sets would require a more sophisticated resolution strategy.
- **Scaling**: For very large datasets, the `listForDisplay` join may need pagination and indexing optimizations.
- **PDF Parsing**: The system relies on LLM-based extraction; adding a rule-based fallback for standardized NDIS templates would increase reliability.
