"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Table,
  Button,
  Popconfirm,
  message,
  Select,
  Input,
  DatePicker,
  Tag,
  Modal,
  Upload,
  Form,
  Row,
  Col,
  Card,
  InputNumber,
  Space
} from "antd";
import {
  UploadOutlined,
  HistoryOutlined,
  ReloadOutlined,
  InboxOutlined,
  PlusOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined
} from "@ant-design/icons";
import type { UploadFile as AntdUploadFile } from "antd/es/upload/interface";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import dayjs from "dayjs";

const { Dragger } = Upload;

interface InvoiceRow {
  id: number;
  invoice_number: string | null;
  invoice_date: string | null;
  amount: string | null;
  expected_amount: string | null;
  status: string;
  client_id: number | null;
  provider_id: number | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_ndis_number: string | null;
  provider_name: string | null;
  provider_abn: string | null;
  source: "uploaded" | "manual";
}

interface SelectOption {
  value: number;
  label: string;
}

interface CategoryOption {
  value: number;
  label: string;
}

interface RawSupportItem {
  id: number;
  category_id: number;
  support_item_number: string;
  support_item_name: string;
  unit: string;
  max_rate?: number | string | null;
  quote?: boolean;
}

interface UploadHistoryRow {
  id: number;
  file_name?: string;
  batch_id?: string;
  created_at: string;
  status: string;
  total_count?: number;
  processed_count?: number;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [clients, setClients] = useState<SelectOption[]>([]);
  const [providers, setProviders] = useState<SelectOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [rawSupportItems, setRawSupportItems] = useState<RawSupportItem[]>([]);
  const [loading, setLoading] = useState(false);

  // --- Upload Invoices Modal States ---
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [fileList, setFileList] = useState<AntdUploadFile[]>([]);

  // --- Add Invoice Modal States & Form ---
  const [addInvoiceModalOpen, setAddInvoiceModalOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [addForm] = Form.useForm();

  // --- Upload History Modal States ---
  const [uploadHistoryModalOpen, setUploadHistoryModalOpen] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Filters
  const [searchNumber, setSearchNumber] = useState("");
  const [clientFilter, setClientFilter] = useState<number | undefined>(
    undefined
  );
  const [providerFilter, setProviderFilter] = useState<number | undefined>(
    undefined
  );
  const [dateFilter, setDateFilter] = useState<dayjs.Dayjs | null>(null);
  const [sourceFilter, setSourceFilter] = useState<
    "uploaded" | "manual" | undefined
  >(undefined);

  async function load() {
    setLoading(true);
    try {
      const [
        invoicesData,
        clientsData,
        providersData,
        categoriesData,
        itemsData
      ] = await Promise.all([
        apiFetch<InvoiceRow[]>("/api/invoices").catch(() => []),
        apiFetch<
          {
            id: number;
            first_name: string;
            last_name: string;
            ndis_number?: string;
          }[]
        >("/api/clients").catch(() => []),
        apiFetch<{ id: number; name: string; abn?: string }[]>(
          "/api/providers"
        ).catch(() => []),
        apiFetch<
          { id: number; category_name: string; category_number: string }[]
        >("/api/categories").catch(() => []),
        apiFetch<RawSupportItem[]>("/api/support-items").catch(() => [])
      ]);

      // 1. Invoices
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);

      // 2. Participant Dropdown Options
      if (Array.isArray(clientsData)) {
        setClients(
          clientsData.map((c) => ({
            value: c.id,
            label: `${c.first_name} ${c.last_name}${c.ndis_number ? ` (${c.ndis_number})` : ""}`
          }))
        );
      } else {
        setClients([]);
      }

      // 3. Provider Dropdown Options
      if (Array.isArray(providersData)) {
        setProviders(
          providersData.map((p) => ({
            value: p.id,
            label: `${p.name}${p.abn ? ` (ABN: ${p.abn})` : ""}`
          }))
        );
      } else {
        setProviders([]);
      }

      // 4. Category Dropdown Options
      if (Array.isArray(categoriesData)) {
        setCategories(
          categoriesData.map((cat) => ({
            value: cat.id,
            label: `${cat.category_number} - ${cat.category_name}`
          }))
        );
      } else {
        setCategories([]);
      }

      // 5. Raw Support Items
      setRawSupportItems(Array.isArray(itemsData) ? itemsData : []);

    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUploadHistory() {
    setHistoryLoading(true);
    try {
      const historyData = await apiFetch<UploadHistoryRow[]>(
        "/api/invoice-uploads"
      );
      setUploadHistory(historyData);
    } catch (e) {
      console.warn("Could not fetch upload history", e);
      setUploadHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openUploadHistory() {
    setUploadHistoryModalOpen(true);
    fetchUploadHistory();
  }

  // --- Dynamic Support Item Filtering & Lookup ---
  function getSupportItemsForCategory(categoryId?: number) {
    if (!categoryId) {
      return rawSupportItems.map((item) => ({
        value: item.id,
        label: `${item.support_item_number} - ${item.support_item_name}`
      }));
    }

    return rawSupportItems
      .filter((item) => item.category_id === categoryId)
      .map((item) => ({
        value: item.id,
        label: `${item.support_item_number} - ${item.support_item_name}`
      }));
  }

  function handleSupportItemSelect(itemId: number, fieldName: number) {
    const selectedItem = rawSupportItems.find((i) => i.id === itemId);
    if (!selectedItem) return;

    const currentItems = addForm.getFieldValue("items") || [];
    const updatedItems = [...currentItems];

    let maxRateDisplay = "No Limit";
    if (selectedItem.quote) {
      maxRateDisplay = "Quote Required";
    } else if (
      selectedItem.max_rate !== undefined &&
      selectedItem.max_rate !== null
    ) {
      maxRateDisplay = `$${Number(selectedItem.max_rate).toFixed(2)}`;
    }

    updatedItems[fieldName] = {
      ...updatedItems[fieldName],
      support_item_id: itemId,
      support_category_id:
        selectedItem.category_id ||
        updatedItems[fieldName]?.support_category_id,
      max_rate: maxRateDisplay,
      unit: updatedItems[fieldName]?.unit || 1
    };

    addForm.setFieldsValue({ items: updatedItems });
    handleItemValueChange();
  }

  // --- Add Invoice Logic ---
  function openAddModal() {
    setEditingInvoiceId(null);
    setAddInvoiceModalOpen(true);
  }

  async function openEditModal(id: number) {
    setEditingInvoiceId(id);
    setAddInvoiceModalOpen(true);
    setLoading(true);
    try {
      const invoice = await apiFetch<any>(`/api/invoices/${id}`);

      addForm.setFieldsValue({
        client_id: invoice.client_id,
        provider_id: invoice.provider_id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date ? dayjs(invoice.invoice_date) : null,
        expected_amount: Number(invoice.expected_amount),
        amount: invoice.amount,
        items: (invoice.items || []).map((item: any) => ({
          service_start_date: item.start_date ? dayjs(item.start_date) : null,
          service_end_date: item.end_date ? dayjs(item.end_date) : null,
          support_category_id: item.category_id,
          support_item_id: item.support_item_id,
          unit: Number(item.unit),
          invoiced_rate: Number(item.input_rate),
          invoiced_amount: item.amount,
          max_rate: item.max_rate,
        }))
      });
    } catch (e: any) {
      message.error(e.message || "Failed to load invoice details");
    } finally {
      setLoading(false);
    }
  }

  function closeAddModal() {
    setEditingInvoiceId(null);
    setAddInvoiceModalOpen(false);
  }

  function handleItemValueChange() {
    const items = addForm.getFieldValue("items") || [];
    let calculatedTotal = 0;

    const updatedItems = items.map((item: any) => {
      const unit = Number(item?.unit) || 0;
      const rate = Number(item?.invoiced_rate) || 0;
      const amount = Math.round((unit * rate) * 100) / 100;
      calculatedTotal += amount;
      return { ...item, invoiced_amount: amount > 0 ? amount.toFixed(2) : "" };
    });

    addForm.setFieldsValue({
      items: updatedItems,
      expected_amount: Math.round(calculatedTotal * 100) / 100,
      amount: calculatedTotal > 0 ? calculatedTotal.toFixed(2) : ""
    });
  }

  async function handleSaveInvoice(status: "draft" | "completed") {
    try {
      const values = await addForm.validateFields();
      setAddSubmitting(true);

      const payload = {
        ...values,
        status: status === "draft" ? "drafted" : "completed",
        invoice_date: values.invoice_date.format("YYYY-MM-DD"),
        items: (values.items || []).map((item: any) => ({
          category_id: item.support_category_id,
          support_item_id: item.support_item_id,
          start_date: item.service_start_date?.format("YYYY-MM-DD"),
          end_date: item.service_end_date?.format("YYYY-MM-DD"),
          unit: item.unit,
          input_rate: item.invoiced_rate,
        }))
      };

      await apiFetch("/api/invoices", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      message.success(
        `Invoice ${status === "draft" ? "saved as draft" : "created"} successfully`
      );
      closeAddModal();
      load();
    } catch (e: any) {
      if (e?.errorFields) return;

      const error = e as any;
      if (error.details) {
        const fieldErrors = Object.entries(error.details).map(([field, messages]) => {
          if (field.startsWith('items[')) {
            const match = field.match(/items\[(\d+)\]\.(.+)/);
            if (match) {
              return {
                name: ['items', parseInt(match[1], 10), match[2]],
                errors: messages as string[],
              };
            }
          }
          return {
            name: field,
            errors: messages as string[],
          };
        });
        addForm.setFields(fieldErrors);
      }

      const detailMessages = error.details ? Object.entries(error.details)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? (msgs as string[]).join(', ') : msgs}`)
        .join('\n') : (error.message || "Failed to save invoice");

      console.error('Validation Errors:', error.details || {});
      message.error(detailMessages);
    } finally {
      setAddSubmitting(false);
    }
  }
  // --- Upload Batch Processing ---
  async function handleUpload() {
    if (fileList.length === 0) return;
    setUploadSubmitting(true);
    try {
      const formData = new FormData();
      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append("files", file.originFileObj);
        }
      });

      const res = await fetch("/api/invoice-uploads", {
        method: "POST",
        body: formData
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Upload failed");

      message.success("Invoices uploaded and processed successfully");
      setFileList([]);
      setUploadModalOpen(false);
      load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setUploadSubmitting(false);
    }
  }

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (searchNumber.trim()) {
        const q = searchNumber.trim().toLowerCase();
        if (!(inv.invoice_number ?? "").toLowerCase().includes(q)) return false;
      }
      if (clientFilter !== undefined && inv.client_id !== clientFilter)
        return false;
      if (providerFilter !== undefined && inv.provider_id !== providerFilter)
        return false;
      if (dateFilter && inv.invoice_date !== dateFilter.format("YYYY-MM-DD"))
        return false;
      if (sourceFilter !== undefined && inv.source !== sourceFilter)
        return false;
      return true;
    });
  }, [
    invoices,
    searchNumber,
    clientFilter,
    providerFilter,
    dateFilter,
    sourceFilter
  ]);

  async function handleDelete(id: number) {
    try {
      await apiFetch(`/api/invoices/${id}`, { method: "DELETE" });
      message.success("Invoice deleted");
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 4 }}>Invoices</h1>
        <p style={{ color: "#888", margin: 0 }}>Manage invoices.</p>
      </div>

      {/* Action Header Buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={load}>
          Refresh
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
          Add Invoice
        </Button>
        <Button
          icon={<UploadOutlined />}
          onClick={() => setUploadModalOpen(true)}
        >
          Upload Invoices
        </Button>
        <Button icon={<HistoryOutlined />} onClick={openUploadHistory}>
          Upload History
        </Button>
      </div>

      {/* Filters Section */}
      <div
        style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
            Invoice Number
          </div>
          <Input
            placeholder="Search invoice number"
            style={{ width: 220 }}
            allowClear
            value={searchNumber}
            onChange={(e) => setSearchNumber(e.target.value)}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
            Participant
          </div>
          <Select
            style={{ width: 220 }}
            placeholder="All participants"
            allowClear
            showSearch
            optionFilterProp="label"
            value={clientFilter}
            onChange={setClientFilter}
            options={clients}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
            Provider
          </div>
          <Select
            style={{ width: 220 }}
            placeholder="All providers"
            allowClear
            showSearch
            optionFilterProp="label"
            value={providerFilter}
            onChange={setProviderFilter}
            options={providers}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
            Invoice Date
          </div>
          <DatePicker
            style={{ width: 200 }}
            placeholder="Select invoice date"
            value={dateFilter}
            onChange={setDateFilter}
            format="DD/MM/YYYY"
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
            Source
          </div>
          <Select
            style={{ width: 160 }}
            placeholder="All sources"
            allowClear
            value={sourceFilter}
            onChange={setSourceFilter}
            options={[
              { value: "manual", label: "Manual" },
              { value: "uploaded", label: "Uploaded" }
            ]}
          />
        </div>
      </div>

      {/* Invoices Table */}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredInvoices}
        scroll={{ x: "max-content" }}
        pagination={{
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50", "100"],
          defaultPageSize: 20,
          showTotal: (total) => `Total: ${total}`
        }}
        columns={[
          {
            title: "Participant",
            render: (_, record) =>
              record.client_id ? (
                <Link href={`/clients?editId=${record.client_id}`}>
                  {record.client_first_name} {record.client_last_name} (
                  {record.client_ndis_number})
                </Link>
              ) : (
                "—"
              )
          },
          {
            title: "Provider",
            render: (_, record) =>
              record.provider_id ? (
                <Link href={`/providers?editId=${record.provider_id}`}>
                  {record.provider_name} ({record.provider_abn})
                </Link>
              ) : (
                "—"
              )
          },
          {
            title: "Invoice Number",
            dataIndex: "invoice_number",
            render: (v) => v || "—"
          },
          {
            title: "Source",
            dataIndex: "source",
            render: (v: "uploaded" | "manual") => (
              <Tag color={v === "uploaded" ? "blue" : "default"}>
                {v === "uploaded" ? "Uploaded" : "Manual"}
              </Tag>
            )
          },
          {
            title: "Invoice Date",
            dataIndex: "invoice_date",
            render: (v: string | null) =>
              v ? dayjs(v).format("DD/MM/YYYY") : "—"
          },
          {
            title: "Expected Amount",
            dataIndex: "expected_amount",
            render: (v) => v ?? "—"
          },
          { title: "Amount", dataIndex: "amount", render: (v) => v ?? "—" },
          {
            title: "Status",
            dataIndex: "status",
            render: (v) => (
              <Tag color={v === "completed" ? "green" : "orange"}>{v}</Tag>
            )
          },
          {
            title: "Actions",
            fixed: "right",
            render: (_, record) => (
              <>
                <Button onClick={() => openEditModal(record.id)}>
                  Edit
                </Button>
                <Popconfirm
                  title="Delete this invoice?"
                  onConfirm={() => handleDelete(record.id)}
                >
                  <Button danger style={{ marginLeft: 8 }}>
                    Delete
                  </Button>
                </Popconfirm>
              </>
            )
          }
        ]}
      />

      {/* ========================================================= */}
      {/* DIRECT INLINED ADD INVOICE MODAL                          */}
      {/* ========================================================= */}
      <Modal
        open={addInvoiceModalOpen}
        onCancel={closeAddModal}
        footer={null}
        width="100vw"
        style={{ top: 0, padding: 0, maxWidth: "100vw" }}
        styles={{
          body: {
            padding: "20px 32px",
            minHeight: "100vh",
            background: "#f8f9fa"
          }
        }}
        closeIcon={null}
      >
        <Form
          form={addForm}
          layout="vertical"
          initialValues={{ items: [{ unit: 1 }] }}
          onValuesChange={handleItemValueChange}
        >
          {/* Header Action Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
              padding: "16px 24px",
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 18,
                fontWeight: 600
              }}
            >
              <CloseOutlined
                style={{ cursor: "pointer", fontSize: 16, color: "#666" }}
                onClick={closeAddModal}
              />
              <span>{editingInvoiceId ? 'Edit' : 'Add'} Invoice</span>
            </div>
            <Space size="middle">
              <Button onClick={closeAddModal}>Cancel</Button>
              <Button
                onClick={() => handleSaveInvoice("draft")}
                loading={addSubmitting}
              >
                Save as Draft
              </Button>
              <Button
                type="primary"
                onClick={() => handleSaveInvoice("completed")}
                loading={addSubmitting}
              >
                Save
              </Button>
            </Space>
          </div>

          {/* Invoice Basic Information */}
          <Card
            title="Invoice Information"
            style={{ marginBottom: 24, borderRadius: 8 }}
            size="small"
          >
            <Row gutter={[16, 8]}>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Form.Item
                  name="client_id"
                  label="Participant"
                  rules={[{ required: true, message: "Select participant" }]}
                >
                  <Select
                    placeholder="Select participant"
                    showSearch
                    optionFilterProp="label"
                    options={clients}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={8} lg={4}>
                <Form.Item
                  name="provider_id"
                  label="Provider"
                  rules={[{ required: true, message: "Select provider" }]}
                >
                  <Select
                    placeholder="Select provider"
                    showSearch
                    optionFilterProp="label"
                    options={providers}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={8} lg={4}>
                <Form.Item
                  name="invoice_number"
                  label="Invoice Number"
                  rules={[{ required: true, message: "Enter invoice number" }]}
                >
                  <Input placeholder="e.g. INV-10024" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={8} lg={4}>
                <Form.Item
                  name="invoice_date"
                  label="Invoice Date"
                  rules={[{ required: true, message: "Select date" }]}
                >
                  <DatePicker
                    style={{ width: "100%" }}
                    format="DD/MM/YYYY"
                    placeholder="Select date"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={8} lg={4}>
                <Form.Item
                  name="expected_amount"
                  label="Expected Amount"
                  rules={[{ required: true, message: "Enter expected amount" }]}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    precision={2}
                    prefix="$"
                    placeholder="0.00"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={8} lg={4}>
                <Form.Item
                  name="amount"
                  label="Amount"
                >
                  <Input
                    prefix="$"
                    readOnly
                    placeholder="0.00"
                    style={{ background: "#f5f5f5", color: "#555" }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Invoice Items Section */}
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16 }}>
                    Items ({fields.length})
                  </h3>
                  <Button
                    type="dashed"
                    onClick={() => add({ unit: 1 })}
                    icon={<PlusOutlined />}
                  >
                    Add Item
                  </Button>
                </div>

                {fields.map((field, index) => {
                  const { key, ...restField } = field;
                  return (
                    <Card
                      key={key}
                      size="small"
                      style={{
                        marginBottom: 16,
                        borderRadius: 8,
                        border: "1px solid #e8e8e8"
                      }}
                      title={
                        <span style={{ fontWeight: 600 }}>#{index + 1}</span>
                      }
                      extra={
                        <Space>
                          <Button
                            type="text"
                            icon={<CopyOutlined style={{ color: "#595959" }} />}
                            onClick={() => {
                              const currentValues = addForm.getFieldValue([
                                "items",
                                field.name
                              ]);
                              add({ ...currentValues });
                            }}
                          />
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(field.name)}
                          />
                        </Space>
                      }
                    >
                      <Row gutter={[16, 8]}>
                        <Col xs={24} sm={12} md={6}>
                          <Form.Item
                            {...restField}
                            name={[field.name, "service_start_date"]}
                            label="Service Start Date"
                            rules={[
                              { required: true, message: "Start date required" }
                            ]}
                          >
                            <DatePicker
                              style={{ width: "100%" }}
                              format="DD/MM/YYYY"
                              placeholder="Select date"
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                          <Form.Item
                            {...restField}
                            name={[field.name, "service_end_date"]}
                            label="Service End Date"
                            rules={[
                              { required: true, message: "End date required" }
                            ]}
                          >
                            <DatePicker
                              style={{ width: "100%" }}
                              format="DD/MM/YYYY"
                              placeholder="Select date"
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                          <Form.Item
                            noStyle
                            shouldUpdate={(prevValues, currentValues) =>
                              prevValues.client_id !== currentValues.client_id
                            }
                          >
                            {() => {
                              const clientId = addForm.getFieldValue("client_id");
                              return (
                                <Form.Item
                                  {...restField}
                                  name={[field.name, "support_category_id"]}
                                  label="Support Category"
                                  rules={[
                                    { required: true, message: "Select category" }
                                  ]}
                                >
                                  <Select
                                    disabled={!clientId}
                                    placeholder="Select category"
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    options={categories}
                                    onChange={() => {
                                      const currentItems =
                                        addForm.getFieldValue("items") || [];
                                      currentItems[field.name].support_item_id =
                                        undefined;
                                      currentItems[field.name].max_rate = undefined;
                                      addForm.setFieldsValue({ items: currentItems });
                                    }}
                                  />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                          <Form.Item
                            noStyle
                            shouldUpdate={(prevValues, currentValues) =>
                              prevValues.items?.[field.name]
                                ?.support_category_id !==
                              currentValues.items?.[field.name]
                                ?.support_category_id
                            }
                          >
                            {() => {
                              const selectedCategoryId = addForm.getFieldValue([
                                "items",
                                field.name,
                                "support_category_id"
                              ]);
                              const filteredItems =
                                getSupportItemsForCategory(selectedCategoryId);

                              return (
                                <Form.Item
                                  {...restField}
                                  name={[field.name, "support_item_id"]}
                                  label="Support Item"
                                  rules={[
                                    { required: true, message: "Select item" }
                                  ]}
                                >
                                  <Select
                                    disabled={!selectedCategoryId}
                                    placeholder="Select support item"
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    options={filteredItems}
                                    onChange={(itemId) =>
                                      handleSupportItemSelect(
                                        itemId,
                                        field.name
                                      )
                                    }
                                  />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={[16, 8]}>
                        <Col xs={12} sm={6} md={3}>
                          <Form.Item
                            {...restField}
                            name={[field.name, "max_rate"]}
                            label="Max Rate"
                          >
                            <Input
                              placeholder="No Limit"
                              readOnly
                              style={{
                                background: "#f5f5f5",
                                color: "#8c8c8c"
                              }}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={12} sm={6} md={3}>
                          <Form.Item
                            {...restField}
                            name={[field.name, "unit"]}
                            label="Unit"
                            rules={[{ required: true, message: "Enter unit" }]}
                          >
                            <InputNumber
                              min={0.01}
                              step={0.5}
                              precision={2}
                              style={{ width: "100%" }}
                              placeholder="1.00"
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={12} sm={6} md={3}>
                          <Form.Item
                            {...restField}
                            name={[field.name, "invoiced_rate"]}
                            label="Invoiced Rate"
                            rules={[{ required: true, message: "Enter rate" }]}
                          >
                            <InputNumber
                              min={0}
                              precision={2}
                              prefix="$"
                              style={{ width: "100%" }}
                              placeholder="0.00"
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={12} sm={6} md={3}>
                          <Form.Item
                            {...restField}
                            name={[field.name, "invoiced_amount"]}
                            label="Invoiced Amount"
                          >
                            <Input
                              prefix="$"
                              readOnly
                              placeholder="0.00"
                              style={{ background: "#f5f5f5", fontWeight: 600 }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  );
                })}

                <Button
                  type="dashed"
                  block
                  onClick={() => add({ unit: 1 })}
                  icon={<PlusOutlined />}
                  style={{ height: 40, marginTop: 8 }}
                >
                  Add Item
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* Upload Invoices Modal */}
      <Modal
        title="Upload Invoices"
        open={uploadModalOpen}
        onCancel={() => {
          setUploadModalOpen(false);
          setFileList([]);
        }}
        footer={[
          <Button key="cancel" onClick={() => setUploadModalOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={uploadSubmitting}
            disabled={fileList.length === 0}
            onClick={handleUpload}
          >
            Upload
          </Button>
        ]}
        width={560}
      >
        <div style={{ padding: "12px 0" }}>
          <Dragger
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            fileList={fileList}
            beforeUpload={(_, newFiles) => {
              setFileList((prev) => [
                ...prev,
                ...newFiles.map((f) => ({
                  uid: f.uid || `${f.name}-${Date.now()}`,
                  name: f.name,
                  status: "done" as const,
                  originFileObj: f
                }))
              ]);
              return false;
            }}
            onRemove={(file) => {
              setFileList((prev) =>
                prev.filter((item) => item.uid !== file.uid)
              );
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: "#1677ff", fontSize: 48 }} />
            </p>
            <p className="ant-upload-text" style={{ fontWeight: 500 }}>
              Click or drag invoice files to this area
            </p>
            <ul
              style={{
                color: "#888",
                fontSize: 12,
                textAlign: "left",
                display: "inline-block",
                margin: 0,
                paddingLeft: 16
              }}
            >
              <li>Supported formats: PDF, Word, and Excel</li>
              <li>Maximum file size: 10 MB per file</li>
              <li>Upload limit: 20 MB total, up to 20 files</li>
            </ul>
          </Dragger>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* DIRECT INLINED UPLOAD HISTORY MODAL                        */}
      {/* ========================================================= */}
      <Modal
        title="Upload History"
        open={uploadHistoryModalOpen}
        onCancel={() => setUploadHistoryModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setUploadHistoryModalOpen(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        <Table
          rowKey="id"
          loading={historyLoading}
          dataSource={uploadHistory}
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "File Name / Batch ID",
              dataIndex: "file_name",
              render: (v, r) => v || r.batch_id || `Batch #${r.id}`
            },
            {
              title: "Upload Date",
              dataIndex: "created_at",
              render: (v) => (v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—")
            },
            {
              title: "Total Invoices",
              dataIndex: "total_count",
              align: "center",
              render: (v) => v ?? "—"
            },
            {
              title: "Processed",
              dataIndex: "processed_count",
              align: "center",
              render: (v) => v ?? "—"
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (v) => {
                const color =
                  v === "completed" || v === "success"
                    ? "green"
                    : v === "failed"
                      ? "red"
                      : "blue";
                return <Tag color={color}>{v}</Tag>;
              }
            }
          ]}
        />
      </Modal>
    </div>
  );
}
