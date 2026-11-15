import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, ChevronRight, MapPin, Truck } from "lucide-react-native";
import { TripSession } from "../../types";
import { BorderRadius, Colors, Spacing, Typography } from "../../theme/colors";

interface TripBannerProps {
  trip: TripSession | null;
  onStartTripPress?: () => void;
}

export const TripBanner: React.FC<TripBannerProps> = ({ trip, onStartTripPress }) => {
  const router = useRouter();

  if (!trip) {
    return (
      <View style={styles.warningContainer}>
        <View style={styles.warningIconCol}>
          <AlertTriangle size={24} color={Colors.clay} />
        </View>
        <View style={styles.warningContent}>
          <Text style={styles.warningTitle}>Trip Session Required</Text>
          <Text style={styles.warningText}>
            You have no active route session. Orders, sales, and payments are locked until you start a trip.
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={onStartTripPress || (() => router.push("/trips/start" as any))}
            activeOpacity={0.8}
          >
            <Truck size={16} color={Colors.textInverse} style={{ marginRight: 6 }} />
            <Text style={styles.startButtonText}>Start Shift Trip</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const startTimeFormatted = trip.startTime
    ? new Date(trip.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "-";

  return (
    <View style={styles.activeContainer}>
      <View style={styles.activeHeader}>
        <View style={styles.routeBadge}>
          <MapPin size={14} color={Colors.textInverse} style={{ marginRight: 4 }} />
          <Text style={styles.routeText}>{trip.route}</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.activeDot} />
          <Text style={styles.statusText}>Active Shift</Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View>
          <Text style={styles.tripNoText}>{trip.tripNo}</Text>
          <Text style={styles.metaText}>Started at {startTimeFormatted}</Text>
        </View>

        <TouchableOpacity
          style={styles.detailsLink}
          onPress={() => router.push("/daily-closing" as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.detailsLinkText}>Trip Summary</Text>
          <ChevronRight size={14} color="#99f6e4" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Warning Box (No active trip)
  warningContainer: {
    backgroundColor: "#fffbeb",
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: "#fde68a",
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: Colors.clay,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2
  },
  warningIconCol: {
    marginRight: Spacing.md,
    marginTop: 2
  },
  warningContent: {
    flex: 1
  },
  warningTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: "#92400e",
    marginBottom: Spacing.xs
  },
  warningText: {
    fontSize: Typography.sm,
    color: "#b45309",
    lineHeight: 18,
    marginBottom: Spacing.md
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.clay,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    alignSelf: "flex-start",
    shadowColor: Colors.clay,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2
  },
  startButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.sm,
    fontWeight: "700"
  },

  // Active Trip Box
  activeContainer: {
    backgroundColor: Colors.leaf,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    shadowColor: Colors.leaf,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  activeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md
  },
  routeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full
  },
  routeText: {
    color: Colors.textInverse,
    fontSize: Typography.sm,
    fontWeight: "700"
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d1fae5",
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.full
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 5
  },
  statusText: {
    color: "#065f46",
    fontSize: Typography.xs,
    fontWeight: "700"
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  tripNoText: {
    color: Colors.textInverse,
    fontSize: Typography.base,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  metaText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: Typography.xs,
    marginTop: 2
  },
  detailsLink: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.md
  },
  detailsLinkText: {
    color: "#99f6e4",
    fontSize: Typography.xs,
    fontWeight: "700",
    marginRight: 2
  }
});

