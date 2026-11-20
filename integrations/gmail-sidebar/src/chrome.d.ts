type MessageSender = { id?: string; url?: string; tab?: { id?: number } };
type ChromeApi = {
  runtime: {
    id: string;
    getURL: (path: string) => string;
    sendMessage: (message: unknown) => Promise<unknown>;
    onMessage: {
      addListener: (
        listener: (
          message: unknown,
          sender: MessageSender,
          respond: (response: unknown) => void,
        ) => boolean | void,
      ) => void;
    };
  };
  tabs: {
    query: (query: {
      active: boolean;
      currentWindow: boolean;
    }) => Promise<Array<{ id?: number; url?: string }>>;
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
  };
  sidePanel: {
    setPanelBehavior: (options: {
      openPanelOnActionClick: boolean;
    }) => Promise<void>;
    open: (options: { tabId: number }) => Promise<void>;
  };
};
declare const chrome: ChromeApi;
