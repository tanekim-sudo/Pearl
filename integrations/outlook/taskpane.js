Office.onReady(() => {
  document.getElementById("insert").addEventListener("click", () => {
    const text = document.getElementById("result").value;
    const status = document.getElementById("status");
    if (!text) {
      status.textContent = "Paste a result first.";
      return;
    }
    Office.context.mailbox.item.body.setSelectedDataAsync(
      text,
      { coercionType: Office.CoercionType.Text },
      (result) => {
        status.textContent = result.status === Office.AsyncResultStatus.Succeeded
          ? `Inserted ${text.length} characters.`
          : result.error.message;
      }
    );
  });
});
