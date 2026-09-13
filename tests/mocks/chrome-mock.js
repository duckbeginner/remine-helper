// tests/mocks/chrome-mock.js
// 표준 가상 Chrome Extension MV3 API 모의 객체 환경 (Node.js 테스트용)

export class ChromeMock {
  constructor() {
    this.reset();
  }

  reset() {
    this._storageData = {};
    this._storageChangeListeners = new Set();
    this._alarmListeners = new Set();
    this._notificationListeners = new Set();
    this._messageListeners = new Set();
    this._installedListeners = new Set();
    this._notificationsCreated = new Map();
    this._activeAlarms = new Map();
    this._badgeState = { text: '', color: '' };
    this._tabs = [{ id: 1, url: 'about:blank', active: true }];
    this._lastError = null;

    const self = this;

    this.storage = {
      local: {
        get: (keys, callback) => {
          if (self._lastError) {
            self.runtime.lastError = self._lastError;
            if (callback) callback({});
            return Promise.resolve({});
          }
          self.runtime.lastError = null;
          let result = {};
          if (!keys) {
            result = { ...self._storageData };
          } else if (typeof keys === 'string') {
            result[keys] = self._storageData[keys];
          } else if (Array.isArray(keys)) {
            keys.forEach(k => { result[k] = self._storageData[k]; });
          } else if (typeof keys === 'object') {
            Object.keys(keys).forEach(k => {
              result[k] = self._storageData[k] !== undefined ? self._storageData[k] : keys[k];
            });
          }
          if (callback) callback(result);
          return Promise.resolve(result);
        },
        set: (items, callback) => {
          if (self._lastError) {
            self.runtime.lastError = self._lastError;
            if (callback) callback();
            return Promise.reject(self._lastError);
          }
          self.runtime.lastError = null;
          const changes = {};
          for (const [k, v] of Object.entries(items)) {
            const oldValue = self._storageData[k];
            self._storageData[k] = v;
            changes[k] = { oldValue, newValue: v };
          }
          self._storageChangeListeners.forEach(listener => {
            try { listener(changes, 'local'); } catch (_) {}
          });
          if (callback) callback();
          return Promise.resolve();
        },
        remove: (keys, callback) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          const changes = {};
          keyList.forEach(k => {
            const oldValue = self._storageData[k];
            delete self._storageData[k];
            changes[k] = { oldValue, newValue: undefined };
          });
          self._storageChangeListeners.forEach(l => l(changes, 'local'));
          if (callback) callback();
          return Promise.resolve();
        },
        clear: (callback) => {
          self._storageData = {};
          if (callback) callback();
          return Promise.resolve();
        }
      },
      onChanged: {
        addListener: (fn) => self._storageChangeListeners.add(fn),
        removeListener: (fn) => self._storageChangeListeners.delete(fn),
        hasListener: (fn) => self._storageChangeListeners.has(fn)
      }
    };

    this.alarms = {
      create: (name, alarmInfo) => {
        self._activeAlarms.set(name, { name, ...alarmInfo, scheduledTime: Date.now() + ((alarmInfo.delayInMinutes || 0) * 60000) });
      },
      clear: (name, callback) => {
        const existed = self._activeAlarms.delete(name);
        if (callback) callback(existed);
        return Promise.resolve(existed);
      },
      get: (name, callback) => {
        const alarm = self._activeAlarms.get(name);
        if (callback) callback(alarm);
        return Promise.resolve(alarm);
      },
      getAll: (callback) => {
        const list = Array.from(self._activeAlarms.values());
        if (callback) callback(list);
        return Promise.resolve(list);
      },
      onAlarm: {
        addListener: (fn) => self._alarmListeners.add(fn),
        removeListener: (fn) => self._alarmListeners.delete(fn),
        trigger: (name) => {
          const alarm = self._activeAlarms.get(name) || { name, scheduledTime: Date.now() };
          self._alarmListeners.forEach(fn => fn(alarm));
        }
      }
    };

    this.notifications = {
      create: (id, options, callback) => {
        const notifId = id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        self._notificationsCreated.set(notifId, { id: notifId, ...options });
        if (callback) callback(notifId);
        return Promise.resolve(notifId);
      },
      clear: (id, callback) => {
        const existed = self._notificationsCreated.delete(id);
        if (callback) callback(existed);
        return Promise.resolve(existed);
      },
      onClicked: {
        addListener: (fn) => self._notificationListeners.add(fn),
        removeListener: (fn) => self._notificationListeners.delete(fn),
        trigger: (id) => self._notificationListeners.forEach(fn => fn(id))
      }
    };

    this.runtime = {
      lastError: null,
      getManifest: () => ({ name: 'Remine Helper', version: '1.0.3', manifest_version: 3 }),
      sendMessage: (message, callback) => {
        let responded = false;
        const sendResponse = (res) => {
          responded = true;
          if (callback) callback(res);
        };
        self._messageListeners.forEach(fn => {
          try { fn(message, {}, sendResponse); } catch (_) {}
        });
        if (!responded && callback) callback(null);
        return Promise.resolve();
      },
      onMessage: {
        addListener: (fn) => self._messageListeners.add(fn),
        removeListener: (fn) => self._messageListeners.delete(fn)
      },
      onInstalled: {
        addListener: (fn) => self._installedListeners.add(fn),
        trigger: (details = { reason: 'install' }) => self._installedListeners.forEach(fn => fn(details))
      }
    };

    this.action = {
      setBadgeText: (details, callback) => {
        self._badgeState.text = details?.text || '';
        if (callback) callback();
        return Promise.resolve();
      },
      setBadgeBackgroundColor: (details, callback) => {
        self._badgeState.color = details?.color || '';
        if (callback) callback();
        return Promise.resolve();
      },
      getBadgeState: () => ({ ...self._badgeState })
    };

    this.tabs = {
      create: (props, callback) => {
        const tab = { id: self._tabs.length + 1, ...props, active: true };
        self._tabs.push(tab);
        if (callback) callback(tab);
        return Promise.resolve(tab);
      },
      query: (queryInfo, callback) => {
        const filtered = self._tabs.filter(t => {
          if (queryInfo.active !== undefined && t.active !== queryInfo.active) return false;
          if (queryInfo.url && !t.url.includes(queryInfo.url.replace(/\*/g, ''))) return false;
          return true;
        });
        if (callback) callback(filtered);
        return Promise.resolve(filtered);
      },
      update: (tabId, props, callback) => {
        const tab = self._tabs.find(t => t.id === tabId);
        if (tab) Object.assign(tab, props);
        if (callback) callback(tab);
        return Promise.resolve(tab);
      }
    };
  }

  // 헬퍼: 스토리지 에러 시뮬레이션 설정
  setStorageError(errorMessage) {
    this._lastError = errorMessage ? { message: errorMessage } : null;
    this.runtime.lastError = this._lastError;
  }

  // 전역 globalThis.chrome에 주입
  installGlobal() {
    globalThis.chrome = this;
    return this;
  }
}

export function setupChromeMock() {
  const mock = new ChromeMock();
  return mock.installGlobal();
}
