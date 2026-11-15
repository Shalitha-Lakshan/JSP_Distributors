import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator
} from "react-native";
import { CheckCircle, Server, WifiOff } from "lucide-react-native";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { Colors } from "../../theme/colors";

export const NetworkStatusBanner: React.FC = () => {
  const { isOnline, isOffline, isServerUnavailable, refreshStatus } =
    useNetworkStatus();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline || isServerUnavailable) {
      setWasOffline(true);
    } else if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isOffline, isServerUnavailable, wasOffline]);

  const handleManualCheck = async () => {
    setIsRefreshing(true);
    try {
      await refreshStatus();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (showReconnected && isOnline) {
    return (
      <View style={[styles.banner, styles.onlineBanner]}>
        <CheckCircle size={15} color="#065f46" />
        <Text style={[styles.bannerText, styles.onlineText]}>
          Back Online. Central database connected.
        </Text>
      </View>
    );
  }

  if (!isOffline && !isServerUnavailable) {
    return null;
  }

  const isServerIssue = isServerUnavailable && !isOffline;

  return (
    <View
      style={[
        styles.banner,
        isServerIssue ? styles.warningBanner : styles.offlineBanner
      ]}
    >
      {isServerIssue ? (
        <Server size={16} color="#92400e" />
      ) : (
        <WifiOff size={16} color="#991b1b" />
      )}
      <View style={styles.textContainer}>
        <Text
          style={[
            styles.bannerTitle,
            isServerIssue ? styles.warningText : styles.offlineText
          ]}
        >
          {isServerIssue ? "Server Unavailable" : "Offline Mode"}
        </Text>
        <Text
          style={[
            styles.bannerSubtext,
            isServerIssue ? styles.warningText : styles.offlineText
          ]}
          numberOfLines={2}
        >
          {isServerIssue
            ? "Central server is unreachable. Showing saved records. Van Order drafts can be prepared offline."
            : "Showing saved records. Van Order drafts can be prepared offline."}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.actionButton,
          isServerIssue ? styles.warningButton : styles.offlineButton
        ]}
        onPress={handleManualCheck}
        disabled={isRefreshing}
        activeOpacity={0.7}
      >
        {isRefreshing ? (
          <ActivityIndicator
            size="small"
            color={isServerIssue ? "#78350f" : "#7f1d1d"}
          />
        ) : (
          <Text
            style={[
              styles.actionButtonText,
              isServerIssue ? styles.warningButtonText : styles.offlineButtonText
            ]}
          >
            Retry
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1
  },
  offlineBanner: {
    backgroundColor: "#fee2e2",
    borderBottomColor: "#fca5a5"
  },
  warningBanner: {
    backgroundColor: "#fef3c7",
    borderBottomColor: "#fcd34d"
  },
  onlineBanner: {
    backgroundColor: "#d1fae5",
    borderBottomColor: "#a7f3d0"
  },
  textContainer: {
    flex: 1
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: "700"
  },
  bannerSubtext: {
    fontSize: 11,
    marginTop: 1,
    opacity: 0.9
  },
  bannerText: {
    fontSize: 12,
    fontWeight: "600"
  },
  offlineText: {
    color: "#991b1b"
  },
  warningText: {
    color: "#92400e"
  },
  onlineText: {
    color: "#065f46"
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1
  },
  offlineButton: {
    backgroundColor: "#fecaca",
    borderColor: "#f87171"
  },
  warningButton: {
    backgroundColor: "#fde68a",
    borderColor: "#f59e0b"
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: "700"
  },
  offlineButtonText: {
    color: "#7f1d1d"
  },
  warningButtonText: {
    color: "#78350f"
  }
});
