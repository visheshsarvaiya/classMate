import React, { useEffect, useState } from "react";
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

const ENDPOINT = "http://localhost:5000"; // ✅ Make sure backend is running
let socket, selectedChatCompare;

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const { selectedChat, user, notification, setNotification } = ChatState();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // === AI Suggestions State ===
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const toast = useToast();

  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData,
    rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
  };

  // === AI Suggestion Function ===
  const fetchAISuggestions = async () => {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

    if (!apiKey) {
      toast({
        title: "API Key Missing",
        description: "Set your Gemini API key in the .env file",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    if (!messages.length) {
      toast({
        title: "No chat history",
        description: "Start chatting to get AI suggestions",
        status: "info",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    try {
      setLoadingSuggestions(true);

      const recentMessages = messages
        .slice(-10)
        .map((m) => `${m.sender.name}: ${m.content}`);

      const prompt = `Suggest 3 professional but friendly replies for the next message in this conversation:\n\n${recentMessages.join(
        "\n"
      )}`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.REACT_APP_GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
        }
      );

      const aiText =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      const suggestions = aiText
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => line.replace(/^\d+\.\s*/, "").trim());

      setAiSuggestions(suggestions);
    } catch (error) {
      console.error("AI Suggestion Error:", error.response || error);
      toast({
        title: "AI Error",
        description: "Failed to fetch AI suggestions",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // === Send Message ===
  const sendMessage = async (event) => {
    if (event.key === "Enter" && newMessage.trim() !== "") {
      if (!selectedChat?._id) return;

      socket.emit("stop typing", selectedChat._id);

      try {
        const config = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };

        const payload = {
          content: newMessage,
          chatId: selectedChat._id,
        };

        const { data } = await axios.post(
          `${ENDPOINT}/api/message`,
          payload,
          config
        );

        setNewMessage("");
        setMessages((prev) => [...prev, data]);
        socket.emit("new message", data);
      } catch (error) {
        console.error("Error sending message:", error.response || error);
        toast({
          title: "Error Occurred!",
          description: "Failed to send message",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "bottom",
        });
      }
    }
  };

  // === Typing Handler ===
  const typingHandler = (e) => {
    setNewMessage(e.target.value);
    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", selectedChat._id);
    }

    let lastTypingTime = new Date().getTime();
    setTimeout(() => {
      const timeNow = new Date().getTime();
      if (timeNow - lastTypingTime >= 3000 && typing) {
        socket.emit("stop typing", selectedChat._id);
        setTyping(false);
      }
    }, 3000);
  };

  // === Setup Socket Connection ===
  useEffect(() => {
    socket = io(ENDPOINT);
    socket.emit("setup", user);
    socket.on("connected", () => setSocketConnected(true));
    socket.on("typing", () => setIsTyping(true));
    socket.on("stop typing", () => setIsTyping(false));

    return () => socket.disconnect();
  }, [user]);

  // === Fetch Messages for Selected Chat ===
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedChat?._id) return;

      try {
        setLoading(true);
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const { data } = await axios.get(
          `${ENDPOINT}/api/message/${selectedChat._id}`,
          config
        );
        setMessages(data);
        setLoading(false);
        socket.emit("join chat", selectedChat._id);
      } catch (error) {
        console.error("Error fetching messages:", error.response || error);
        setLoading(false);
        toast({
          title: "Error Occurred!",
          description: "Failed to load messages",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "bottom",
        });
      }
    };

    fetchMessages();
    selectedChatCompare = selectedChat;
  }, [selectedChat, user, toast]);

  // === Listen for Incoming Messages ===
  useEffect(() => {
    const handleMessageReceived = (newMessageReceived) => {
      if (
        !selectedChatCompare ||
        selectedChatCompare._id !== newMessageReceived.chat._id
      ) {
        if (!notification.find((n) => n._id === newMessageReceived._id)) {
          setNotification([newMessageReceived, ...notification]);
          setFetchAgain(!fetchAgain);
        }
        toast({
          title: `New message from ${newMessageReceived.sender.name}`,
          status: "info",
          duration: 3000,
          isClosable: true,
          position: "bottom-right",
        });
      } else {
        setMessages((prev) => [...prev, newMessageReceived]);
      }
    };

    socket.on("message received", handleMessageReceived);
    return () => socket.off("message received", handleMessageReceived);
  }, [selectedChat, notification, fetchAgain, setNotification, setFetchAgain, toast]);

  return (
    <>
      {selectedChat ? (
        <>
          {/* === Chat Header === */}
          <Text
            fontSize={{ base: "28px", md: "30px" }}
            pb={3}
            px={2}
            w="100%"
            fontFamily="Work sans"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            {!selectedChat.isGroupChat ? (
              <>
                {getSender(user, selectedChat.users)}
                <ProfileModal user={getSenderFull(user, selectedChat.users)} />
              </>
            ) : (
              <>
                {selectedChat.chatName.toUpperCase()}
                <UpdateGroupChatModal
                  fetchMessages={async () => {
                    if (!selectedChat?._id) return;
                    try {
                      const config = {
                        headers: { Authorization: `Bearer ${user.token}` },
                      };
                      const { data } = await axios.get(
                        `${ENDPOINT}/api/message/${selectedChat._id}`,
                        config
                      );
                      setMessages(data);
                      socket.emit("join chat", selectedChat._id);
                    } catch (error) {
                      toast({
                        title: "Error Occurred!",
                        description: "Failed to load messages",
                        status: "error",
                        duration: 5000,
                        isClosable: true,
                        position: "bottom",
                      });
                    }
                  }}
                  fetchAgain={fetchAgain}
                  setFetchAgain={setFetchAgain}
                />
              </>
            )}
          </Text>

          {/* === Chat Box === */}
          <Box
            display="flex"
            flexDir="column"
            justifyContent="flex-end"
            p={3}
            bg="#E8E8E8"
            w="100%"
            h="100%"
            borderRadius="lg"
            overflowY="hidden"
          >
            {loading ? (
              <Text>Loading...</Text>
            ) : (
              <ScrollableChat messages={messages} />
            )}

            {/* === AI Suggestions === */}
            <Box bg="white" p={2} borderRadius="md" mt={2}>
              <Button
                size="sm"
                colorScheme="blue"
                onClick={fetchAISuggestions}
                isLoading={loadingSuggestions}
              >
                Get AI Suggestions
              </Button>
              {aiSuggestions.length > 0 && (
                <Box mt={2}>
                  {aiSuggestions.map((s, i) => (
                    <Button
                      key={i}
                      size="sm"
                      m={1}
                      variant="outline"
                      onClick={() => setNewMessage(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </Box>
              )}
            </Box>

            {/* Typing Animation */}
            {isTyping && (
              <div>
                <Lottie
                  options={defaultOptions}
                  width={70}
                  style={{ marginBottom: 15, marginLeft: 0 }}
                />
              </div>
            )}

            {/* Input Box */}
            <FormControl isRequired mt={3}>
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
        <Box display="flex" alignItems="center" justifyContent="center" h="100%">
          <Text fontSize="3xl" pb={3} fontFamily="Work sans">
            Click on a user to start chatting
          </Text>
        </Box>
      )}
    </>
  );
};

export default SingleChat;
