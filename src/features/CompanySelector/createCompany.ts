import { getHomeDirectory, writeFile } from '@/services/apiAdapt';
import { type Company, useWorkspaceStore } from '@/stores/useWorkspaceStore';

function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'cong-ty'
  );
}

function agentsMdSeed(name: string, mst: string): string {
  return `# AGENTS.md

## Công ty
- Tên: ${name}
- Mã số thuế: ${mst}

## Ghi chú
- Đây là workspace riêng của công ty này trong AccountingX — dữ liệu và lịch sử trò chuyện ở đây không trộn với công ty khác.
- AI không tự ký, không tự nộp chứng từ hay tờ khai; gửi email ra ngoài và ghi sổ sách (MISA) phải qua duyệt kèm bằng chứng.
- Nhắn Zalo cho người đã đăng ký trong AccountingX (báo kết quả, gửi tóm tắt, hỏi lại thông tin) thì gửi thẳng bằng zalo_send_message, không cần hỏi duyệt.
`;
}

/**
 * Create a new company workspace under `~/.accountingx/companies/<mst>/`,
 * seed its `AGENTS.md`, register it, and select it. The folder is created
 * implicitly by `writeFile` (it makes missing parent directories), so there
 * is no separate "create directory" step.
 *
 * MST (mã số thuế / tax code) is required — it is the one identifier
 * guaranteed to tell two companies apart, so it is also the folder name.
 */
export async function createCompany(params: { name: string; mst: string }): Promise<Company> {
  const name = params.name.trim();
  const mst = params.mst.trim();
  if (!name) {
    throw new Error('Company name is required');
  }
  if (!mst) {
    throw new Error('Tax code (MST) is required');
  }

  const existing = useWorkspaceStore.getState().companies;
  const taken = new Set(existing.map((c) => c.path.split('/').filter(Boolean).pop()));
  const base = slugify(mst);
  let slug = base;
  let suffix = 2;
  while (taken.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  const home = await getHomeDirectory();
  const path = `${home}/.accountingx/companies/${slug}`;

  await writeFile(`${path}/AGENTS.md`, agentsMdSeed(name, mst));

  const company: Company = { path, name, mst };
  const { addCompany, addProjectAndSelect } = useWorkspaceStore.getState();
  addCompany(company);
  addProjectAndSelect(path);
  return company;
}
