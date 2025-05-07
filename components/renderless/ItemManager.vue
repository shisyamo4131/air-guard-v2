<script>
/**
 * A renderless component for object management.
 * It takes an object as a `model-value` and provides various functions for editing it.
 *
 * オブジェクト管理用のレンダーレスコンポーネントです。
 * `model-value` としてオブジェクトを受け取り、これを編集するための様々な機能を提供します。
 *
 * [How to use]
 * <RenderlessItemManager v-model="someObject">
 *  <template #default="{ item, submit, updateProperties }">
 *    <v-card>
 *      <v-card-text>
 *        <v-text-field
 *          :model-value="item.name"
 *          @update:modelValue="updateProperties({ name: $event })"
 *        />
 *      </v-card-text>
 *      <v-card-actions>
 *        <v-btn @click="submit">submit</v-btn>
 *      </v-card-actions>
 *    </v-card>
 *  </template>
 * </RenderlessItemManager>
 */
import { computed, ref, watch } from "vue";

export default {
  props: {
    /**
     * Function executed just before the component enters edit mode.
     * - Not performed when switching between edit modes using `toggleEditMode`.
     *
     * コンポーネントが編集モードに入る直前に実行される関数です。
     * - `toggleEditMode` を使って編集モードを切り替える際は実行されません。
     *
     * (editMode) => Promise<void>
     */
    beforeEdit: Function,

    /**
     * Function executed just before the `delete` event is emitted.
     * It can take `item` as an argument.
     *
     * `delete` イベントが emit される直前に実行される関数です。
     * 引数で `item` を受け取ることができます。
     *
     * (item) => Promise<void>
     */
    handleDelete: Function,

    /**
     * Function executed just before the `update` event is emitted.
     * It can take `item` as an argument.
     *
     * `update` イベントが emit される直前に実行される関数です。
     * 引数で編集後の `item` を受け取ることができます。
     *
     * (item) => Promise<void>
     */
    handleUpdate: Function,

    /**
     * Indicates that the component is in `editing`.
     * - On receipt of true, the component enters `UPDATE` mode.
     * - Synchronisation via `update:isEditing` is possible.
     *
     * コンポーネントの状態が `編集中` であることを表します。
     * - true を受け取るとコンポーネントは `変更モード` になります。
     * - `update:isEditing` による同期が可能です。
     */
    isEditing: Boolean,

    /**
     * When switching to `change` or `delete` mode, you can customise
     * the initialization process for the target item.
     *
     * `変更` または `削除` モードに切り替える際、対象アイテムの初期化処理を
     * カスタムすることができます。
     *
     * (item) => Promise<Object>
     */
    itemConverter: Function,

    /**
     * Managed object, the value of the component's v-model.
     *
     * 管理対象のオブジェクトで、コンポーネントの v-model の値です。
     */
    modelValue: Object,
  },
  emits: [
    "delete",
    "initialized",
    "update",
    "update:modelValue",
    "update:isEditing",
    "submit:complete",
  ],
  setup(props, context) {
    /**
     * Editable object duplicated from props.modelValue.
     *
     * `props.modelValue` から複製された編集対象のオブジェクト
     */
    const editItem = ref(null);

    const editModes = ["UPDATE", "DELETE"];
    const editMode = ref(null);

    /**
     * Array of messages of errors that occurred in the component.
     *
     * コンポーネント内で発生したエラーのメッセージの配列
     */
    const errors = ref([]);

    /**
     * Indicate that the component is editing mode.
     *
     * コンポーネントの状態が編集中であることを表すフラグ
     */
    const internalIsEditing = ref(false);

    /**
     * Item managed by this component.
     *
     * コンポーネントが管理するアイテム
     */
    const internalItem = ref(null);

    /**
     * Indicate that the component is processing.
     *
     * コンポーネントが処理中であることを表すフラグ
     */
    const loading = ref(false);

    /**
     * The `isEditing` property used internally by the component.
     * emit `update:isEditing` event in setter.
     *
     * コンポーネントが内部で使用する `isEditing` プロパティ
     * セッターで `update:isEditing` イベントを emit
     */
    const computedIsEditing = computed({
      get() {
        return internalIsEditing.value;
      },
      set(v) {
        internalIsEditing.value = v;
        context.emit("update:isEditing", v);
      },
    });

    /** コンポーネントが `編集モード` であるかどうかを表すフラグ */
    /**
     * Indicate that the component is in `UPDATE` mode.
     *
     * コンポーネントが `UPDATE` モードであることを表すフラグ
     */
    const isUpdate = computed(() => editMode.value === "UPDATE");

    /**
     * Indicate that the component is in `DELETE` mode.
     *
     * コンポーネントが `DELETE` モードであることを表すフラグ
     */
    const isDelete = computed(() => editMode.value === "DELETE");

    /**
     * Indicate that the component has some error or not.
     *
     * コンポーネントがエラー状態かどうかを表すフラグ。
     */
    const hasError = computed(() => errors.value.length > 0);

    /**
     * Clears all error messages and resets the component's error state.
     *
     * コンポーネントのエラー状態をリセットし、すべてのエラーメッセージを削除します。
     *
     * @returns {void} No return value.
     *                 戻り値はありません。
     */
    function clearError() {
      errors.value.splice(0);
    }

    /**
     * Ends the editing state of the component.
     * - A watcher will trigger the component's initialization process upon exiting edit mode.
     *
     * コンポーネントの状態を `編集終了` にします。
     * - ウォッチャーによりコンポーネントの初期化処理が実行されます。
     *
     * @returns {void} No return value.
     *                 戻り値はありません。
     */
    function quitEditing() {
      computedIsEditing.value = false;
    }

    /**
     * Logs an error message and detailed information to the console,
     * and sets the component into an error state.
     *
     * エラーメッセージと詳細情報をコンソールに出力し、コンポーネントをエラー状態にします。
     *
     * @param {string} message - The error description.
     *                           エラーの説明。
     * @param {Record<string, any>=} payload - Additional details about the error.
     *                                         エラーに関する追加情報（省略可能）。
     * @returns {void} No return value.
     *                 戻り値はありません。
     */
    function setError(message, payload) {
      console.error(`[RenderlessItemManager.vue] ${message}`, payload);
      errors.value.push(message);
    }

    /**
     * Finalizes the editing or deletion of the item currently being edited.
     * - If `editMode` is `UPDATE`, the edit is finalized.
     * - If `editMode` is `DELETE`, the deletion is finalized.
     *
     * 現在編集中のアイテムの編集または削除を完了させます。
     * - `editMode` が `UPDATE` の場合、編集を完了させます。
     * - `editMode` が `DELETE` の場合、削除を完了させます。
     *
     * @returns {Promise<void>} Resolves when the operation is successfully completed.
     *                          処理が正常に完了すると解決されるプロミス
     * @throws {Error} Throws an error if the editing or deletion process fails.
     *                 編集または削除の処理に失敗した場合にエラーを投げます
     * @emits {Object} submit:complete - Emitted when the process is successfully completed,
     *                                   containing `editMode` as the mode of operation.
     *                                   処理が正常に完了した際に `editMode` を含むオブジェクトを渡して発火します。
     */
    async function submit() {
      // コンポーネントのエラー状態を初期化
      clearError();

      // コンポーネントの状態が `編集中` でなければエラーを出力して終了
      if (!computedIsEditing.value) {
        setError(`Cannot submit because it is not being edited.`);
        return;
      }

      // editItem が設定されていない、またはオブジェクトではない場合はエラーを出力して終了
      if (!editItem.value || typeof editItem.value !== "object") {
        setError(`Cannot submit because editItem is not set.`);
        return;
      }

      // 処理中に更新
      loading.value = true;

      try {
        // 編集モードに合わせて処理
        if (editMode.value === "UPDATE") {
          await _handleModifyItem();
        } else if (editMode.value === "DELETE") {
          await _handleRemoveItem();
        }

        // 編集モードを終了する
        quitEditing();

        // `submit:compute` イベントを emit
        context.emit("submit:complete", { editMode: editMode.value });
      } catch (err) {
        const message = `Failed to submit process.`;
        console.error(message, err);
        setError(message, err);
      } finally {
        loading.value = false;
      }
    }

    /**
     * Switches the component's edit mode to the specified mode.
     * - Use this function when changing only the edit mode, without using `toUpdate` or `toDelete`.
     *
     * コンポーネントの編集モードを指定されたモードに切り替えます。
     * - `toUpdate` や `toDelete` を使用せず、編集モードのみを切り替える場合に使用します。
     *
     * @param {("UPDATE" | "DELETE")} mode - The edit mode to switch to. Must be either `"UPDATE"` or `"DELETE"`.
     *                                       切り替える編集モード。`"UPDATE"` または `"DELETE"` である必要があります。
     * @returns {void} This function does not return a value.
     *                 戻り値はありません。
     */
    function toggleEditMode(mode) {
      // コンポーネントのエラー状態を初期化
      clearError();

      // 編集モードの妥当性チェック
      if (!editModes.includes(mode)) {
        const message = `Invalid editMode was specified. editMode: ${mode}`;
        setError(message);
        return;
      }
      editMode.value = mode;
    }

    /**
     * Sets the component's state to "edit mode".
     * - This function switches the component to edit mode by setting the mode to `"UPDATE"`.
     *
     * コンポーネントの状態を「編集モード」に設定します。
     * - この関数は、コンポーネントを編集モードに切り替え、`"UPDATE"` に設定します。
     *
     * @returns {Promise<void>} Resolves when the edit mode is successfully activated.
     *                          編集モードが正常に有効化されると解決されるプロミス。
     */
    async function toUpdate() {
      await _toEdit("UPDATE");
    }

    /**
     * Sets the component's state to "delete mode".
     * - This function switches the component to delete mode by setting the mode to `"DELETE"`.
     *
     * コンポーネントの状態を「削除モード」に設定します。
     * - この関数は、コンポーネントを削除モードに切り替え、`"DELETE"` に設定します。
     *
     * @returns {Promise<void>} Resolves when the delete mode is successfully activated.
     *                          削除モードが正常に有効化されると解決されるプロミス。
     */
    async function toDelete() {
      await _toEdit("DELETE");
    }

    /**
     * Updates the `editItem` object with the properties specified in the argument.
     * - This function is used to individually update the properties of `editItem` from UI components.
     *
     * 引数に指定されたオブジェクトの内容で `editItem` を更新します。
     * - UI コンポーネントから `editItem` のプロパティを個別に更新するために使用します。
     *
     * @param {Record<string, any>} obj - An object where keys are property names and values are the updated values.
     *                                     更新するプロパティ名をキー、更新後の値をバリューとしたオブジェクト。
     * @returns {void} No return value.
     *                 戻り値はありません。
     * @throws {TypeError} Throws an error if the argument is not an object.
     *                     引数がオブジェクトでない場合に `TypeError` をスローします。
     */
    function updateProperties(obj = {}) {
      if (obj === null || typeof obj !== "object") {
        throw new TypeError(
          `The argument must be an object. Received ${typeof obj}.`
        );
      }

      // editItem が設定されていない、またはオブジェクトでない場合は警告を出力して終了
      if (!editItem.value || typeof editItem.value !== "object") {
        console.warn(
          `Cannot update properties: editItem is not defined or invalid.`
        );
        return;
      }

      Object.entries(obj).forEach(([key, value]) => {
        if (key in editItem.value) {
          editItem.value[key] = value;
        } else {
          console.warn(`Property '${key}' does not exist in editItem.`);
        }
      });
    }

    /**
     * Returns a duplicate of the given object.
     * - This function creates a deep copy of the provided object.
     *
     * オブジェクトを複製して返します。
     * - この関数は、指定されたオブジェクトのディープコピーを作成します。
     *
     * @param {Record<string, any>=} obj - The object to be duplicated. Defaults to `null`.
     *                                     複製対象のオブジェクト。デフォルトは `null`。
     * @returns {Record<string, any>} A cloned object.
     *                                複製されたオブジェクト。
     */
    // function _cloneObject(obj = null) {
    //   try {
    //     if (obj === null || typeof obj !== "object") {
    //       throw new TypeError(
    //         `Invalid argument: Expected an object, but received ${
    //           obj === null ? "null" : typeof obj
    //         }.`
    //       );
    //     }

    //     const proto = Object.getPrototypeOf(obj);
    //     const newObj = proto?.constructor
    //       ? new proto.constructor()
    //       : Object.create(proto);

    //     for (const key of Object.keys(obj)) {
    //       const value = obj[key];
    //       newObj[key] =
    //         value && typeof value === "object" ? _cloneObject(value) : value;
    //     }

    //     return newObj;
    //   } catch (err) {
    //     console.error(`[RenderlessItemManager.vue] An error has occured.`, err);
    //   }
    // }

    function _cloneObject(obj = null) {
      // null や undefined、プリミティブ型はそのまま返す
      if (obj === null || typeof obj !== "object") {
        return obj;
      }

      // FireModel インスタンスなどで clone メソッドが定義されていればそれを使う
      if (typeof obj.clone === "function") {
        try {
          // FireModel 自身の clone() を呼び出す
          return obj.clone();
        } catch (err) {
          console.error(
            `[ItemManager.vue] Failed to clone object using its clone method.`,
            err,
            obj
          );
          // エラー時は null や例外を投げるなど、適切なエラー処理を行う
          // ここでは null を返す例
          return null;
        }
      }

      // --- clone メソッドがないプレーンオブジェクトなどの場合のフォールバック ---
      // (この部分は FireModel 以外も扱う場合に必要)
      console.warn(
        "[ItemManager.vue] Cloning object without a dedicated 'clone' method. Using generic deep clone (may lose methods/prototype).",
        obj
      );
      try {
        // structuredClone はメソッドやプロトタイプを失うが、循環参照に強く安全
        return structuredClone(obj);

        /*
        // または、以前の簡易的な実装 (循環参照に弱い)
        const proto = Object.getPrototypeOf(obj);
        const newObj = proto?.constructor
          ? new proto.constructor() // コンストラクタ引数問題は残る
          : Object.create(proto);

        for (const key of Object.keys(obj)) {
          const value = obj[key];
          // 再帰呼び出しにも clone メソッドチェックを入れるのがより安全
          newObj[key] = (value && typeof value === 'object') ? _cloneObject(value) : value;
        }
        return newObj;
        */
      } catch (err) {
        console.error(
          `[ItemManager.vue] Failed to clone plain object.`,
          err,
          obj
        );
        return null; // エラー時は null を返す例
      }
    }

    /**
     * Executes when a component in "edit mode" receives a submit instruction.
     * - Emits the `update:modelValue` event with the modified item.
     * - Simultaneously, emits the `update` event.
     * - If `handleUpdate` is specified, it executes before emitting the events.
     *
     * `編集モード` であるコンポーネントが submit の指示を受けた時に実行される処理です。
     * - 編集後のアイテムを `update:modelValue` イベントで emit します。
     * - 同時に `update` イベントも emit します。
     * - `handleUpdate` 関数が指定されている場合、イベントを emit する直前にこれを実行します。
     *
     * @returns {Promise<void>} Resolves when the update process is successfully completed.
     *                          更新処理が正常に完了すると解決されるプロミス。
     * @throws {Error} Throws an error if the update process fails.
     *                 更新処理中にエラーが発生した場合にエラーをスローします。
     */
    async function _handleModifyItem() {
      try {
        if (typeof props.handleUpdate === "function") {
          await props.handleUpdate(editItem.value);
        }

        internalItem.value = _cloneObject(editItem.value);
        context.emit("update:modelValue", internalItem.value);
        context.emit("update", internalItem.value);
      } catch (err) {
        setError(`Failed to modify item: ${err.message}`, err);
        throw err;
      }
    }

    /**
     * Executes when a component in "delete mode" receives a submit instruction.
     * - Emits the `delete` event with the item to be deleted.
     * - If `handleDelete` is specified, it executes before emitting the event.
     *
     * `削除モード` であるコンポーネントが submit の指示を受けた時に実行される処理です。
     * - `delete` イベントで削除対象のアイテムを emit します。
     * - `handleDelete` 関数が指定されている場合、イベントを emit する直前にこれを実行します。
     *
     * @returns {Promise<void>} Resolves when the deletion process is successfully completed.
     *                          削除処理が正常に完了すると解決されるプロミス。
     * @throws {Error} Throws an error if the deletion process fails.
     *                 削除処理中にエラーが発生した場合にエラーをスローします。
     */
    async function _handleRemoveItem() {
      try {
        if (typeof props.handleDelete === "function") {
          await props.handleDelete(editItem.value);
        }

        context.emit("delete", editItem.value);
      } catch (err) {
        setError(`Failed to remove item: ${err.message}`, err);
        throw err;
      }
    }

    /**
     * Initializes the component's state.
     * - Sets the edit mode to `"UPDATE"`.
     * - Initializes the `editItem` state.
     * - Clears any existing errors.
     * - Emits the `"initialized"` event.
     *
     * コンポーネントの状態を初期化します。
     * - 編集モードを `"UPDATE"` に設定します。
     * - `editItem` の状態を初期化します。
     * - 既存のエラーをクリアします。
     * - `"initialized"` イベントを emit します。
     *
     * @returns {void} No return value.
     *                 戻り値はありません。
     */
    function _initialize() {
      editMode.value = "UPDATE";
      _initializeEditItem();
      clearError();
      context.emit("initialized");
    }

    /**
     * Initializes the target item (`editItem`).
     * - If `props.itemConverter` is specified, `editItem` is initialized with its return value.
     * - If `props.itemConverter` is not specified, `editItem` is initialized with `internalItem`.
     *
     * 編集対象アイテム（`editItem`）を初期化します。
     * - `props.itemConverter` が指定されている場合は、その返り値で `editItem` を初期化します。
     * - `props.itemConverter` が指定されていない場合は、`internalItem` で初期化されます。
     *
     * @returns {Promise<void>} Resolves when `editItem` is successfully initialized.
     *                          `editItem` が正常に初期化されると解決されるプロミス。
     * @throws {Error} Throws an error if `itemConverter` fails.
     *                 `itemConverter` の処理に失敗した場合、エラーをスローします。
     */
    async function _initializeEditItem() {
      const initItem = props.itemConverter
        ? await props.itemConverter(internalItem.value).catch((err) => {
            const message = `Failed to convert item.`;
            setError(message, err);
            throw err;
          })
        : internalItem.value;

      Object.entries(initItem).forEach(([key, value]) => {
        if (key in editItem.value) {
          editItem.value[key] = value;
        }
      });
    }

    /**
     * Changes the component's state to the specified `mode`.
     * - If `props.beforeEdit` is specified, it executes before switching the edit mode.
     * - Clears any existing errors before setting the new mode.
     * - Initializes `editItem` and sets the component to editing mode.
     *
     * コンポーネントの状態を引数 `mode` で指定された状態に変更します。
     * - `props.beforeEdit` が指定されている場合は、編集モードを変更する前に実行されます。
     * - 既存のエラーをクリアしてから、新しいモードを設定します。
     * - `editItem` を初期化し、コンポーネントを編集状態にします。
     *
     * @param {("UPDATE" | "DELETE")} mode - The edit mode to switch to. Must be `"UPDATE"` or `"DELETE"`.
     *                                       切り替える編集モード。`"UPDATE"` または `"DELETE"` である必要があります。
     * @returns {Promise<void>} Resolves when the component's state is successfully updated.
     *                          コンポーネントの状態が正常に更新されると解決されるプロミス。
     * @throws {Error} Throws an error if `beforeEdit` fails or if an error occurs during initialization.
     *                 `beforeEdit` の実行や初期化処理中にエラーが発生した場合、エラーをスローします。
     */
    async function _toEdit(mode) {
      loading.value = true;
      try {
        // props.beforeEdit が指定されている場合は実行
        if (typeof props.beforeEdit === "function") {
          try {
            await props.beforeEdit({
              isUpdate,
              isDelete,
            });
          } catch (err) {
            setError(`An error occurred in beforeEdit.`, err);
            return;
          }
        }

        // コンポーネントのエラー状態を初期化
        clearError();

        // 編集モードを変更
        toggleEditMode(mode);

        // editItem を初期化
        await _initializeEditItem();

        // コンポーネントを編集状態に変更
        computedIsEditing.value = true;
      } catch (err) {
        const message = `An error occurred while switching to edit mode. editMode: ${mode}`;
        setError(message, err);
        throw err;
      } finally {
        loading.value = false;
      }
    }

    /**
     * Sync `props.modelValue` to `internalItem` and `editItem`.
     *
     * `modelValue`　を `internalItem` と `editItem` に同期します。
     */
    watch(
      () => props.modelValue,
      (v) => {
        internalItem.value = _cloneObject(v);
        editItem.value = _cloneObject(v);
      },
      { immediate: true, deep: true }
    );

    /** internalIsEditing が false に更新されたら初期化処理を実行 */
    watch(internalIsEditing, (v) => {
      if (!v) _initialize();
    });

    /** sync isEditing to internalIsEditing */
    watch(
      () => props.isEditing,
      (v) => {
        internalIsEditing.value = v;
      },
      { immediate: true }
    );

    return () =>
      context.slots.default({
        hasError: hasError.value,
        isEditing: computedIsEditing.value,
        item: editItem.value,
        quitEditing,
        setError,
        submit,
        toUpdate,
        toDelete,
        toggleEditMode,
        updateProperties,
      });
  },
};
</script>
