import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Text,
  Input,
  FormControl,
  useToast,
  Button,
} from "@chakra-ui/react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import ProfileModal from "./miscellaneous/ProfileModal";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import { ChatState } from "../Context/ChatProvider";
import axios from "axios";
import ScrollableChat from "./ScrollableChat";
import io from "socket.io-client";
import Lottie from "react-lottie";
import animationData from "../animations/typing.json";

const ENDPOINT = "https://classmate-3.onrender.com";
let socket;

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const { selectedChat, user, notification, setNotification } = ChatState();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const toast = useToast();
  const selectedChatIdRef = useRef(null);

  useEffect(() => {
    selectedChatIdRef.current = selectedChat?._id || null;
  }, [selectedChat]);

  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData,
    rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
  };

  // ================= SOCKET SETUP (FIXED LINE ONLY) =================
  useEffect(() => {
    if (!socket) {
      socket = io(ENDPOINT, {
        withCredentials: true, // ✅ FIX
      });

      socket.emit("setup", user);
      socket.on("connected", () => setSocketConnected(true));
      socket.on("typing", () => setIsTyping(true));
      socket.on("stop typing", () => setIsTyping(false));
    }
  }, [user]);

  // ================= FETCH MESSAGES =================
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedChat?._id) return;

      try {
        setLoading(true);
        const config = {
          headers: { Authorization: `Bearer ${user.token}` },
        };

        const { data } = await axios.get(
          `${ENDPOINT}/api/message/${selectedChat._id}`,
          config
        );

        setMessages(data);
        socket.emit("join chat", selectedChat._id);
        setLoading(false);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load messages",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        setLoading(false);
      }
    };

    setMessages([]);
    fetchMessages();
  }, [selectedChat, user, toast]);

  // ================= SEND MESSAGE =================
  const sendMessage = async (event) => {
    if (event.key === "Enter" && newMessage.trim() !== "") {
      socket.emit("stop typing", selectedChatIdRef.current);

      try {
        const config = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };

        const { data } = await axios.post(
          `${ENDPOINT}/api/message`,
          {
            content: newMessage,
            chatId: selectedChatIdRef.current,
          },
          config
        );

        setNewMessage("");
        setMessages((prev) => [...prev, data]);
        socket.emit("new message", data);
      } catch {
        toast({
          title: "Error",
          description: "Failed to send message",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    }
  };

  // ================= TYPING HANDLER =================
  const typingHandler = (e) => {
    setNewMessage(e.target.value);

    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", selectedChatIdRef.current);
    }

    const lastTypingTime = Date.now();
    setTimeout(() => {
      const timeNow = Date.now();
      if (timeNow - lastTypingTime >= 3000 && typing) {
        socket.emit("stop typing", selectedChatIdRef.current);
        setTyping(false);
      }
    }, 3000);
  };

  // ================= RECEIVE MESSAGE =================
  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (newMessageReceived) => {
      if (newMessageReceived.chat._id !== selectedChatIdRef.current) {
        if (!notification.find((n) => n._id === newMessageReceived._id)) {
          setNotification([newMessageReceived, ...notification]);
          setFetchAgain((prev) => !prev);
        }
      } else {
        setMessages((prev) => [...prev, newMessageReceived]);
      }
    };

    socket.on("message received", handleMessageReceived);
    return () => socket.off("message received", handleMessageReceived);
  }, [notification, setNotification, setFetchAgain]);

  return (
    <>
      {selectedChat ? (
        <>
          <Text
            fontSize="30px"
            pb={3}
            px={2}
            w="100%"
            display="flex"
            justifyContent="space-between"
          >
            {!selectedChat.isGroupChat ? (
              <>
                {getSender(user, selectedChat.users)}
                <ProfileModal
                  user={getSenderFull(user, selectedChat.users)}
                />
              </>
            ) : (
              <>
                {selectedChat.chatName.toUpperCase()}
                <UpdateGroupChatModal
                  fetchAgain={fetchAgain}
                  setFetchAgain={setFetchAgain}
                />
              </>
            )}
          </Text>

          <Box
            display="flex"
            flexDir="column"
            justifyContent="flex-end"
            p={3}
            bg="#E8E8E8"
            w="100%"
            h="100%"
            borderRadius="lg"
          >
            {loading ? (
              <Text>Loading...</Text>
            ) : (
              <ScrollableChat messages={messages} />
            )}

            {isTyping && (
              <Lottie options={defaultOptions} width={70} />
            )}

            <FormControl mt={3}>
              <Input
                variant="filled"
                bg="#E0E0E0"
                placeholder="Enter a message..."
                value={newMessage}
                onChange={typingHandler}
                onKeyDown={sendMessage}
              />
            </FormControl>
          </Box>
        </>
      ) : (
        <Box h="100%" display="flex" alignItems="center" justifyContent="center">
          <Text fontSize="3xl">Click on a user to start chatting</Text>
        </Box>
      )}
    </>
  );
};

export default SingleChat;