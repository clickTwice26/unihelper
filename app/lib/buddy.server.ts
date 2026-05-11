import { db } from "~/lib/db.server";

export type SocialRelation =
  | "available"
  | "outgoing"
  | "incoming"
  | "closed";

export type SocialDirectoryUser = {
  id: string;
  displayName: string | null;
  acceptRequests: boolean;
  createdAt: Date;
  relation: SocialRelation;
  requestId: string | null;
};

export type IncomingBuddyRequest = {
  id: string;
  createdAt: Date;
  sender: {
    id: string;
    displayName: string | null;
    isPublic: boolean;
  };
};

export type AcceptedBuddy = {
  id: string;
  displayName: string | null;
  isPublic: boolean;
  createdAt: Date;
  connectedAt: Date;
};

function getCanonicalPair(userIdOne: string, userIdTwo: string) {
  const [userAId, userBId] = [userIdOne, userIdTwo].sort();
  return {
    userAId,
    userBId,
    pairKey: `${userAId}:${userBId}`,
  };
}

function isKnownPrismaError(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === code
  );
}

export async function getSocialDirectory(
  viewerId: string,
  searchQuery = "",
): Promise<{
  publicUsers: SocialDirectoryUser[];
  incomingRequests: IncomingBuddyRequest[];
  acceptedBuddies: AcceptedBuddy[];
  viewerHasBuddy: boolean;
}> {
  const trimmedSearch = searchQuery.trim().slice(0, 100);
  const [publicUsers, pendingRequests, connections] = await Promise.all([
    db.user.findMany({
      where: {
        isPublic: true,
        NOT: { id: viewerId },
        ...(trimmedSearch
          ? { displayName: { contains: trimmedSearch, mode: "insensitive" } }
          : {}),
      },
      select: {
        id: true,
        displayName: true,
        acceptRequests: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.buddyRequest.findMany({
      where: {
        status: "PENDING",
        OR: [{ senderId: viewerId }, { receiverId: viewerId }],
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            displayName: true,
            isPublic: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.buddyConnection.findMany({
      where: {
        OR: [{ userAId: viewerId }, { userBId: viewerId }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        userAId: true,
        userBId: true,
        userA: {
          select: {
            id: true,
            displayName: true,
            isPublic: true,
            createdAt: true,
          },
        },
        userB: {
          select: {
            id: true,
            displayName: true,
            isPublic: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const acceptedBuddies = connections.map((connection) => {
    const buddy = connection.userAId === viewerId ? connection.userB : connection.userA;

    return {
      ...buddy,
      connectedAt: connection.createdAt,
    };
  });

  const buddyIds = new Set(acceptedBuddies.map((buddy) => buddy.id));
  const viewerHasBuddy = acceptedBuddies.length > 0;

  const outgoingRequests = new Map<string, string>();
  const incomingRequests = new Map<string, string>();

  for (const request of pendingRequests) {
    if (request.senderId === viewerId) {
      outgoingRequests.set(request.receiverId, request.id);
    }

    if (request.receiverId === viewerId) {
      incomingRequests.set(request.senderId, request.id);
    }
  }

  return {
    publicUsers: publicUsers.filter((user) => !buddyIds.has(user.id)).map((user) => {
      let relation: SocialRelation = "available";
      let requestId: string | null = null;

      if (incomingRequests.has(user.id)) {
        relation = "incoming";
        requestId = incomingRequests.get(user.id) ?? null;
      } else if (outgoingRequests.has(user.id)) {
        relation = "outgoing";
        requestId = outgoingRequests.get(user.id) ?? null;
      } else if (viewerHasBuddy) {
        // Viewer already has a buddy — can't send new requests
        relation = "closed";
      } else if (!user.acceptRequests) {
        relation = "closed";
      }

      return {
        ...user,
        relation,
        requestId,
      };
    }),
    viewerHasBuddy,
    incomingRequests: pendingRequests
      .filter((request) => request.receiverId === viewerId)
      .map((request) => ({
        id: request.id,
        createdAt: request.createdAt,
        sender: request.sender,
      })),
    acceptedBuddies,
  };
}

export async function sendBuddyRequest(senderId: string, receiverId: string) {
  if (!senderId || !receiverId) {
    throw new Error("INVALID_REQUEST");
  }

  if (senderId === receiverId) {
    throw new Error("SELF_REQUEST");
  }

  const { pairKey } = getCanonicalPair(senderId, receiverId);

  try {
    return await db.$transaction(async (tx) => {
      const [targetUser, existingConnection, existingRequest, senderConnection, receiverConnection] = await Promise.all([
        tx.user.findUnique({
          where: { id: receiverId },
          select: { id: true, isPublic: true, acceptRequests: true },
        }),
        tx.buddyConnection.findUnique({ where: { pairKey } }),
        tx.buddyRequest.findUnique({ where: { pairKey } }),
        tx.buddyConnection.findFirst({
          where: { OR: [{ userAId: senderId }, { userBId: senderId }] },
        }),
        tx.buddyConnection.findFirst({
          where: { OR: [{ userAId: receiverId }, { userBId: receiverId }] },
        }),
      ]);

      if (!targetUser) {
        throw new Error("USER_NOT_FOUND");
      }

      if (!targetUser.isPublic) {
        throw new Error("USER_NOT_PUBLIC");
      }

      if (!targetUser.acceptRequests) {
        throw new Error("REQUESTS_DISABLED");
      }

      if (existingConnection) {
        throw new Error("ALREADY_BUDDIES");
      }

      if (senderConnection) {
        throw new Error("SENDER_HAS_BUDDY");
      }

      if (receiverConnection) {
        throw new Error("RECEIVER_HAS_BUDDY");
      }

      if (!existingRequest) {
        return tx.buddyRequest.create({
          data: {
            pairKey,
            senderId,
            receiverId,
            status: "PENDING",
          },
        });
      }

      if (existingRequest.status === "PENDING") {
        if (existingRequest.senderId === senderId) {
          throw new Error("REQUEST_ALREADY_SENT");
        }

        throw new Error("INCOMING_REQUEST_EXISTS");
      }

      if (existingRequest.status === "ACCEPTED") {
        throw new Error("ALREADY_BUDDIES");
      }

      return tx.buddyRequest.update({
        where: { pairKey },
        data: {
          senderId,
          receiverId,
          status: "PENDING",
          respondedAt: null,
        },
      });
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      throw new Error("REQUEST_ALREADY_EXISTS");
    }

    throw error;
  }
}

export async function acceptBuddyRequest(receiverId: string, requestId: string) {
  if (!receiverId || !requestId) {
    throw new Error("INVALID_REQUEST");
  }

  try {
    return await db.$transaction(async (tx) => {
      const request = await tx.buddyRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          pairKey: true,
          senderId: true,
          receiverId: true,
          status: true,
        },
      });

      if (!request) {
        throw new Error("REQUEST_NOT_FOUND");
      }

      if (request.receiverId !== receiverId) {
        throw new Error("FORBIDDEN_REQUEST");
      }

      if (request.status !== "PENDING") {
        throw new Error("REQUEST_NOT_PENDING");
      }

      const { userAId, userBId } = getCanonicalPair(request.senderId, request.receiverId);

      // Enforce one-buddy-per-user at accept time too
      const [receiverConnection, senderConnection] = await Promise.all([
        tx.buddyConnection.findFirst({
          where: { OR: [{ userAId: request.receiverId }, { userBId: request.receiverId }] },
        }),
        tx.buddyConnection.findFirst({
          where: { OR: [{ userAId: request.senderId }, { userBId: request.senderId }] },
        }),
      ]);

      if (receiverConnection) {
        throw new Error("RECEIVER_HAS_BUDDY");
      }

      if (senderConnection) {
        throw new Error("SENDER_HAS_BUDDY");
      }

      await tx.buddyConnection.upsert({
        where: { pairKey: request.pairKey },
        create: {
          pairKey: request.pairKey,
          userAId,
          userBId,
        },
        update: {},
      });

      return tx.buddyRequest.update({
        where: { id: request.id },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
        },
      });
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      throw new Error("ALREADY_BUDDIES");
    }

    throw error;
  }
}

export async function removeBuddy(actorId: string, buddyId: string) {
  if (!actorId || !buddyId) throw new Error("INVALID_REQUEST");
  if (actorId === buddyId) throw new Error("INVALID_REQUEST");

  const { pairKey } = getCanonicalPair(actorId, buddyId);

  const connection = await db.buddyConnection.findUnique({ where: { pairKey } });
  if (!connection) throw new Error("NOT_BUDDIES");
  if (connection.userAId !== actorId && connection.userBId !== actorId) {
    throw new Error("FORBIDDEN");
  }

  await db.$transaction([
    db.buddyConnection.delete({ where: { pairKey } }),
    // Remove the accepted request so either party can re-request later
    db.buddyRequest.deleteMany({ where: { pairKey } }),
  ]);
}