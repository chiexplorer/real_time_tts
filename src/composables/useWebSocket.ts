import { ref, onUnmounted } from 'vue';

export interface WebSocketOptions {
  url: string;
  onMessage?: (data: Blob | string) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(options: WebSocketOptions) {
  const {
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5
  } = options;

  const ws = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const reconnectAttempts = ref(0);
  let reconnectTimer: number | null = null;

  const connect = () => {
    try {
      ws.value = new WebSocket(url);
      
      ws.value.onopen = () => {
        console.log('WebSocket connected');
        isConnected.value = true;
        reconnectAttempts.value = 0;
        onOpen?.();
      };
      
      ws.value.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          // JSON 消息
          try {
            const data = JSON.parse(event.data);
            onMessage?.(data);
          } catch (e) {
            console.error('Failed to parse JSON message:', e);
          }
        } else {
          // 二进制音频数据
          onMessage?.(event.data);
        }
      };
      
      ws.value.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };
      
      ws.value.onclose = () => {
        console.log('WebSocket closed');
        isConnected.value = false;
        onClose?.();
        
        // 自动重连
        if (reconnectAttempts.value < maxReconnectAttempts) {
          reconnectTimer = window.setTimeout(() => {
            reconnectAttempts.value++;
            console.log(`Reconnecting... Attempt ${reconnectAttempts.value}`);
            connect();
          }, reconnectInterval);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }
    
    isConnected.value = false;
  };

  const send = (data: any) => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(data));
      return true;
    }
    console.warn('WebSocket is not connected');
    return false;
  };

  // 组件卸载时自动断开连接
  onUnmounted(() => {
    disconnect();
  });

  return {
    ws,
    isConnected,
    connect,
    disconnect,
    send
  };
}