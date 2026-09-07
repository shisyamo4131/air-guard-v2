export function createEmployeeListSession({ subscribe, changed = () => {} }) {
  let generation = 0;
  let stop = null;
  let criteria = null;
  let items = [];
  let loading = false;
  let error = "";

  function publish() {
    changed({ items: [...items], loading, error });
  }

  function invalidate() {
    generation += 1;
    stop?.();
    stop = null;
  }

  function clear() {
    invalidate();
    criteria = null;
    items = [];
    loading = false;
    error = "";
    publish();
  }

  function load(nextCriteria) {
    invalidate();
    criteria = nextCriteria;
    items = [];
    loading = false;
    error = "";

    if (!criteria) {
      publish();
      return;
    }

    const source = generation;
    loading = true;
    publish();

    try {
      const unsubscribe = subscribe(
        criteria,
        (nextItems) => {
          if (source !== generation) return;
          if (!Array.isArray(nextItems)) {
            items = [];
            loading = false;
            error = "従業員情報を取得できません。再読込してください。";
            publish();
            return;
          }
          items = [...nextItems];
          loading = false;
          error = "";
          publish();
        },
        () => {
          if (source !== generation) return;
          items = [];
          loading = false;
          error = "従業員情報を取得できません。再読込してください。";
          publish();
        },
      );
      if (source === generation) stop = unsubscribe;
      else unsubscribe?.();
    } catch {
      if (source !== generation) return;
      items = [];
      loading = false;
      error = "従業員情報を取得できません。再読込してください。";
      publish();
    }
  }

  function reload() {
    load(criteria);
  }

  return {
    clear,
    load,
    reload,
    dispose: clear,
    snapshot: () => ({ items: [...items], loading, error }),
  };
}
