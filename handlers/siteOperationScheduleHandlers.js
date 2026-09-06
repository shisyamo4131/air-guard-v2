// Schedule persistence is owned by the dedicated operation editor/commands.
const unsupported = async () => { throw new Error("予定の保存は専用編集画面から実行してください。"); };
export const handleCreate = unsupported;
export const handleUpdate = unsupported;
export const handleDelete = unsupported;
