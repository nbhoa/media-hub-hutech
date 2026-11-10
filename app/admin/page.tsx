
"use client";

import { useEffect, useState } from "react";
import { configured, supabase } from "@/lib/supabase";

type Row = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  category: string | null;
  cover_image: string | null;
  image_urls: string[] | null;
  event_date: string | null;
  start_time: string | null;
  location: string | null;
  registration_url: string | null;
  status: string;
  created_at: string;
};

const blank = () => ({
  title: "",
  slug: "",
  summary: "",
  content: "",
  category: "Workshop",
  cover_image: "",
  image_urls: [] as string[],
  event_date: "",
  start_time: "",
  location: "",
  registration_url: "",
  status: "draft",
});

const slugify = (s: string) =>
  s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function Admin() {
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"events" | "posts">("events");
  const [form, setForm] = useState<any>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // KIỂM TRA QUYỀN TÀI KHOẢN VÀ TẢI NỘI DUNG
  async function refresh(s: any) {
    if (!s?.user?.id) {
      setRole("");
      setRows([]);
      return;
    }

    setMsg("");

    console.log("USER EMAIL:", s.user.email);
    console.log("USER ID:", s.user.id);

    // Đọc quyền từ bảng profiles
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", s.user.id)
        .maybeSingle();

    console.log("PROFILE:", profile);
    console.log("PROFILE ERROR:", profileError);

    if (profileError) {
      setMsg("Lỗi đọc quyền: " + profileError.message);
      setRole("");
      return;
    }

    if (!profile) {
      setMsg("Không tìm thấy hồ sơ tài khoản trong bảng profiles.");
      setRole("");
      return;
    }

    const userRole = String(profile.role || "")
      .toLowerCase()
      .trim();

    console.log("CURRENT ROLE:", userRole);

    setRole(userRole);

    // Tải dữ liệu sự kiện hoặc bài viết
    const { data, error } = await supabase
      .from(tab)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMsg("Lỗi tải nội dung: " + error.message);
    } else {
      setRows(data || []);
    }
  }

  // KIỂM TRA PHIÊN ĐĂNG NHẬP
  useEffect(() => {
    let mounted = true;

    if (!configured) {
      setLoading(false);
      return;
    }

    async function init() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }

      setSession(data.session);

      if (data.session) {
        await refresh(data.session);
      }

      if (mounted) setLoading(false);
    }

    init();

    // Theo dõi trạng thái đăng nhập
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;

      setSession(s);

      // Trì hoãn truy vấn để tránh xung đột Auth của Supabase
      setTimeout(() => {
        if (!mounted) return;

        if (s) {
          refresh(s);
        } else {
          setRole("");
          setRows([]);
        }
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [tab]);

  // ĐĂNG NHẬP
  async function login(e: any) {
    e.preventDefault();
    setMsg("");

    const email = e.currentTarget.email.value;
    const password = e.currentTarget.password.value;

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setMsg(error.message);
      return;
    }

    setSession(data.session);

    if (data.session) {
      await refresh(data.session);
    }
  }

  // ĐĂNG XUẤT
  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setRole("");
    setRows([]);
  }

  // THAY ĐỔI DỮ LIỆU FORM
  function change(k: string, v: any) {
    setForm((f: any) => ({
      ...f,
      [k]: v,
      ...(k === "title" && !editing
        ? { slug: slugify(v) }
        : {}),
    }));
  }

  // TẢI ẢNH LÊN SUPABASE STORAGE
  async function upload(
    file: File,
    field: "cover_image" | "image_urls"
  ) {
    if (!session) return;

    setUploading(true);

    const ext =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const path =
      `${session.user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("media")
      .upload(path, file, {
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      setMsg(error.message);
    } else {
      const { data } = supabase.storage
        .from("media")
        .getPublicUrl(path);

      if (field === "cover_image") {
        change(field, data.publicUrl);
      } else {
        setForm((f: any) => ({
          ...f,
          image_urls: [
            ...(f.image_urls || []),
            data.publicUrl,
          ],
        }));
      }
    }

    setUploading(false);
  }

  // TẠO NỘI DUNG MỚI
  function startNew() {
    setEditing(null);
    setForm(blank());
    setMsg("");
  }

  // CHỈNH SỬA NỘI DUNG
  function startEdit(r: Row) {
    setEditing(r.id);
    setForm({
      ...r,
      image_urls: r.image_urls || [],
    });
    setMsg("");
  }

  // LƯU NỘI DUNG
  async function save(e: any) {
    e.preventDefault();

    const payload = {
      ...form,
      slug: form.slug || slugify(form.title),
      event_date: form.event_date || null,
      start_time: form.start_time || null,
      registration_url: form.registration_url || null,
      summary: form.summary || null,
      content: form.content || null,
      location: form.location || null,
      cover_image: form.cover_image || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = editing
      ? await supabase
          .from(tab)
          .update(payload)
          .eq("id", editing)
      : await supabase
          .from(tab)
          .insert(payload);

    if (error) {
      setMsg(error.message);
    } else {
      setMsg("Đã lưu nội dung.");
      startNew();
      await refresh(session);
    }
  }

  // XÓA NỘI DUNG
  async function remove(id: string) {
    if (!confirm("Bạn chắc chắn muốn xóa nội dung này?")) {
      return;
    }

    const { error } = await supabase
      .from(tab)
      .delete()
      .eq("id", id);

    setMsg(error ? error.message : "Đã xóa.");

    await refresh(session);
  }

  // KIỂM TRA KẾT NỐI DATABASE
  if (!configured) {
    return (
      <main className="adminShell">
        <div className="loginBox">
          <h1>Chưa kết nối cơ sở dữ liệu</h1>
          <p>
            Điền thông tin Supabase vào biến môi trường
            theo README, sau đó khởi động lại website.
          </p>
          <a href="/">← Về trang chủ</a>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <div className="adminShell">
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }

  // MÀN HÌNH ĐĂNG NHẬP
  if (!session) {
    return (
      <main className="adminShell">
        <form className="loginBox" onSubmit={login}>
          <a href="/" className="back">
            ← Trang chủ
          </a>

          <div className="brandmark">M</div>

          <label>MEDIA HUB · ADMIN</label>

          <h1>Đăng nhập quản trị</h1>

          <p>
            Dành cho tài khoản đã được quản trị viên cấp quyền.
          </p>

          <input
            name="email"
            type="email"
            placeholder="Email"
            required
          />

          <input
            name="password"
            type="password"
            placeholder="Mật khẩu"
            required
          />

          <button className="btn" type="submit">
            Đăng nhập
          </button>

          {msg && <p className="message">{msg}</p>}
        </form>
      </main>
    );
  }

  // KIỂM TRA QUYỀN QUẢN TRỊ
  const canManage = [
    "admin",
    "editor",
    "organizer",
  ].includes(role);

  // GIAO DIỆN QUẢN TRỊ
  return (
    <main className="dashboard">
      <aside className="side">
        <a href="/" className="brand">
          <span className="brandmark">M</span>
          <span>
            MEDIA HUB
            <small>ADMIN CONSOLE</small>
          </span>
        </a>

        <p className="sideLabel">
          KHÔNG GIAN QUẢN TRỊ
        </p>

        <button
          className={tab === "events" ? "sideActive" : ""}
          onClick={() => {
            setTab("events");
            startNew();
          }}
        >
          ▦　Sự kiện
        </button>

        <button
          className={tab === "posts" ? "sideActive" : ""}
          onClick={() => {
            setTab("posts");
            startNew();
          }}
        >
          ▤　Bài viết
        </button>

        <a href="/">↗　Xem website</a>

        <div className="sideBottom">
          <small>Vai trò: {role || "Đang kiểm tra"}</small>
          <button onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </aside>

      <section className="dashMain">
        <div className="dashTop">
          <div>
            <label>BẢNG ĐIỀU KHIỂN</label>
            <h1>Xin chào!</h1>
            <p>
              Quản lý nội dung và hoạt động của MEDIA HUB.
            </p>
          </div>

          <span className="roleTag">
            {role || "Chưa xác định"}
          </span>
        </div>

        {!canManage ? (
          <div className="notice">
            {msg ||
              "Tài khoản hiện chưa được cấp quyền quản trị nội dung. Vui lòng kiểm tra lại quyền tài khoản."}
          </div>
        ) : (
          <>
            <div className="dashStats">
              <div>
                <small>TỔNG NỘI DUNG</small>
                <b>{rows.length}</b>
              </div>

              <div>
                <small>ĐÃ XUẤT BẢN</small>
                <b>
                  {
                    rows.filter(
                      (r) => r.status === "published"
                    ).length
                  }
                </b>
              </div>

              <div>
                <small>BẢN NHÁP</small>
                <b>
                  {
                    rows.filter(
                      (r) => r.status === "draft"
                    ).length
                  }
                </b>
              </div>
            </div>

            <div className="editorLayout">
              <div className="editorPanel">
                <div className="panelHead">
                  <div>
                    <label>
                      {editing ? "CHỈNH SỬA" : "TẠO MỚI"}
                    </label>

                    <h2>
                      {tab === "events"
                        ? "Thông tin sự kiện"
                        : "Bài viết mới"}
                    </h2>
                  </div>

                  <button
                    className="smallBtn"
                    onClick={startNew}
                  >
                    + Mới
                  </button>
                </div>

                <form
                  onSubmit={save}
                  className="editorForm"
                >
                  <label>Tiêu đề *</label>

                  <input
                    value={form.title}
                    onChange={(e) =>
                      change("title", e.target.value)
                    }
                    required
                    placeholder="Nhập tiêu đề nội dung"
                  />

                  <label>Đường dẫn (slug)</label>

                  <input
                    value={form.slug}
                    onChange={(e) =>
                      change("slug", e.target.value)
                    }
                    placeholder="ten-bai-viet"
                  />

                  <label>Danh mục</label>

                  <select
                    value={form.category || "Workshop"}
                    onChange={(e) =>
                      change("category", e.target.value)
                    }
                  >
                    {[
                      "Workshop",
                      "Triển lãm",
                      "Cuộc thi",
                      "Giao lưu",
                      "Tin tức",
                      "Hoạt động",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>

                  <label>Mô tả ngắn</label>

                  <textarea
                    rows={2}
                    value={form.summary || ""}
                    onChange={(e) =>
                      change("summary", e.target.value)
                    }
                    placeholder="Tóm tắt nội dung..."
                  />

                  <label>Nội dung chi tiết</label>

                  <textarea
                    rows={7}
                    value={form.content || ""}
                    onChange={(e) =>
                      change("content", e.target.value)
                    }
                    placeholder="Viết nội dung bài đăng..."
                  />

                  {tab === "events" && (
                    <>
                      <label>Ngày tổ chức</label>

                      <input
                        type="date"
                        value={form.event_date || ""}
                        onChange={(e) =>
                          change("event_date", e.target.value)
                        }
                      />

                      <label>Thời gian</label>

                      <input
                        value={form.start_time || ""}
                        onChange={(e) =>
                          change("start_time", e.target.value)
                        }
                        placeholder="08:00 – 11:00"
                      />

                      <label>Địa điểm</label>

                      <input
                        value={form.location || ""}
                        onChange={(e) =>
                          change("location", e.target.value)
                        }
                        placeholder="Địa điểm tổ chức"
                      />

                      <label>Link đăng ký</label>

                      <input
                        type="url"
                        value={form.registration_url || ""}
                        onChange={(e) =>
                          change(
                            "registration_url",
                            e.target.value
                          )
                        }
                        placeholder="https://..."
                      />
                    </>
                  )}

                  <label>Ảnh bìa</label>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) upload(file, "cover_image");
                    }}
                  />

                  {form.cover_image && (
                    <img
                      className="preview"
                      src={form.cover_image}
                      alt="Ảnh bìa xem trước"
                    />
                  )}

                  <label>Album / hình ảnh nội dung</label>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(
                        e.target.files || []
                      );

                      files.forEach((file) =>
                        upload(file, "image_urls")
                      );

                      e.target.value = "";
                    }}
                  />

                  <div className="thumbs">
                    {(form.image_urls || []).map(
                      (u: string, i: number) => (
                        <img
                          key={i}
                          src={u}
                          alt={`Ảnh ${i + 1}`}
                        />
                      )
                    )}
                  </div>

                  <label>Trạng thái</label>

                  <select
                    value={form.status || "draft"}
                    onChange={(e) =>
                      change("status", e.target.value)
                    }
                  >
                    <option value="draft">
                      Lưu bản nháp
                    </option>

                    <option value="published">
                      Xuất bản công khai
                    </option>
                  </select>

                  <button
                    className="btn"
                    disabled={uploading}
                    type="submit"
                  >
                    {uploading
                      ? "Đang tải ảnh…"
                      : editing
                      ? "Cập nhật nội dung"
                      : "Lưu nội dung"}
                  </button>

                  {msg && (
                    <p className="message">{msg}</p>
                  )}
                </form>
              </div>

              <div className="listPanel">
                <div className="panelHead">
                  <div>
                    <label>KHO NỘI DUNG</label>

                    <h2>
                      {tab === "events"
                        ? "Sự kiện"
                        : "Bài viết"}{" "}
                      ({rows.length})
                    </h2>
                  </div>
                </div>

                {rows.length === 0 ? (
                  <p className="muted">
                    Chưa có nội dung. Tạo mục đầu tiên ở biểu mẫu.
                  </p>
                ) : (
                  rows.map((r) => (
                    <div className="rowItem" key={r.id}>
                      {r.cover_image ? (
                        <img
                          src={r.cover_image}
                          alt=""
                        />
                      ) : (
                        <div className="rowPlaceholder">
                          M
                        </div>
                      )}

                      <div className="rowInfo">
                        <b>{r.title}</b>

                        <small>
                          {r.status === "published"
                            ? "Đã xuất bản"
                            : "Bản nháp"}{" "}
                          · {r.category}
                        </small>
                      </div>

                      <button
                        onClick={() => startEdit(r)}
                      >
                        Sửa
                      </button>

                      <button
                        className="delete"
                        onClick={() => remove(r.id)}
                      >
                        Xóa
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
