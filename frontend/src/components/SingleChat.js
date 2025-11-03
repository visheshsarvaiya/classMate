// import React, { useEffect, useRef, useState } from "react";
// import {
//   Box,
//   Text,
//   Input,
//   FormControl,
//   useToast,
//   Button,
// } from "@chakra-ui/react";
// import { getSender, getSenderFull } from "../config/ChatLogics";
// import ProfileModal from "./miscellaneous/ProfileModal";
// import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
// import { ChatState } from "../Context/ChatProvider";
// import axios from "axios";
// import ScrollableChat from "./ScrollableChat";
// import io from "socket.io-client";
// import Lottie from "react-lottie";
// import animationData from "../animations/typing.json";

// const ENDPOINT = "https://classmate-3.onrender.com";
// let socket; // single instance

// const SingleChat = ({ fetchAgain, setFetchAgain }) => {
//   const { selectedChat, user, notification, setNotification } = ChatState();

//   const [messages, setMessages] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [newMessage, setNewMessage] = useState("");
//   const [socketConnected, setSocketConnected] = useState(false);
//   const [typing, setTyping] = useState(false);
//   const [isTyping, setIsTyping] = useState(false);

//   // === AI Suggestions State ===
//   const [aiSuggestions, setAiSuggestions] = useState([]);
//   const [loadingSuggestions, setLoadingSuggestions] = useState(false);

//   const toast = useToast();

//   // --- keep latest selectedChatId in a ref to avoid stale closure
//   const selectedChatIdRef = useRef(null);
//   useEffect(() => {
//     selectedChatIdRef.current = selectedChat?._id || null;
//   }, [selectedChat]);

//   const defaultOptions = {
//     loop: true,
//     autoplay: true,
//     animationData: animationData,
//     rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
//   };

//   // === AI Suggestion Function ===
//   const fetchAISuggestions = async () => {
//     const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

//     if (!apiKey) {
//       toast({
//         title: "API Key Missing",
//         description: "Set your Gemini API key in the .env file",
//         status: "error",
//         duration: 5000,
//         isClosable: true,
//         position: "bottom",
//       });
//       return;
//     }

//     if (!messages.length) {
//       toast({
//         title: "No chat history",
//         description: "Start chatting to get AI suggestions",
//         status: "info",
//         duration: 3000,
//         isClosable: true,
//         position: "bottom",
//       });
//       return;
//     }

//     try {
//       setLoadingSuggestions(true);

//       const recentMessages = messages
//         .slice(-10)
//         .map((m) => `${m.sender.name}: ${m.content}`);

//       const prompt = `Suggest 3 professional but friendly replies for the next message in this conversation:\n\n${recentMessages.join(
//         "\n"
//       )}`;

//       const response = await axios.post(
//         `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.REACT_APP__API_KEY}`,
//         {
//           contents: [{ parts: [{ text: prompt }] }],
//         }
//       );

//       const aiText =
//         response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

//       const suggestions = aiText
//         .split("\n")
//         .filter((line) => line.trim() !== "")
//         .map((line) => line.replace(/^\d+\.\s*/, "").trim());

//       setAiSuggestions(suggestions);
//     } catch (error) {
//       console.error("AI Suggestion Error:", error.response || error);
//       toast({
//         title: "AI Error",
//         description: "Failed to fetch AI suggestions",
//         status: "error",
//         duration: 5000,
//         isClosable: true,
//         position: "bottom",
//       });
//     } finally {
//       setLoadingSuggestions(false);
//     }
//   };

//   // === Setup Socket Connection (single connect) ===
//   useEffect(() => {
//     if (!socket) {
//       socket = io(ENDPOINT, { transports: ["websocket"] });
//       socket.emit("setup", user);
//       socket.on("connected", () => setSocketConnected(true));
//       socket.on("typing", () => setIsTyping(true));
//       socket.on("stop typing", () => setIsTyping(false));
//     }
//     return () => {
//       // don't disconnect globally on unmount of this component if app reuses socket elsewhere
//       // If this is the only socket user, uncomment next line:
//       // socket?.disconnect();
//     };
//   }, [user]);

//   // === Fetch Messages for Selected Chat ===
//   useEffect(() => {
//     const fetchMessages = async () => {
//       if (!selectedChat?._id) return;

//       try {
//         setLoading(true);
//         const config = { headers: { Authorization: `Bearer ${user.token}` } };
//         const { data } = await axios.get(
//           `${ENDPOINT}/api/message/${selectedChat._id}`,
//           config
//         );
//         setMessages(data);
//         setLoading(false);

//         // join room for this chat
//         socket?.emit("join chat", selectedChat._id);
//       } catch (error) {
//         console.error("Error fetching messages:", error.response || error);
//         setLoading(false);
//         toast({
//           title: "Error Occurred!",
//           description: "Failed to load messages",
//           status: "error",
//           duration: 5000,
//           isClosable: true,
//           position: "bottom",
//         });
//       }
//     };

//     // clear old messages when switching chats (optional but helps UI)
//     setMessages([]);
//     fetchMessages();
//   }, [selectedChat, user, toast]);

//   // === Send Message ===
//   const sendMessage = async (event) => {
//     if (event.key === "Enter" && newMessage.trim() !== "") {
//       if (!selectedChatIdRef.current) return;

//       socket?.emit("stop typing", selectedChatIdRef.current);

//       try {
//         const config = {
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${user.token}`,
//           },
//         };

//         const payload = {
//           content: newMessage,
//           chatId: selectedChatIdRef.current,
//         };

//         const { data } = await axios.post(
//           `${ENDPOINT}/api/message`,
//           payload,
//           config
//         );

//         setNewMessage("");

//         // same chat? push locally; else let notification handle it
//         if (data?.chat?._id && data.chat._id === selectedChatIdRef.current) {
//           setMessages((prev) => [...prev, data]);
//         }
//         socket?.emit("new message", data);
//       } catch (error) {
//         console.error("Error sending message:", error.response || error);
//         toast({
//           title: "Error Occurred!",
//           description: "Failed to send message",
//           status: "error",
//           duration: 5000,
//           isClosable: true,
//           position: "bottom",
//         });
//       }
//     }
//   };

//   // === Typing Handler ===
//   const typingHandler = (e) => {
//     setNewMessage(e.target.value);
//     if (!socketConnected || !selectedChatIdRef.current) return;

//     if (!typing) {
//       setTyping(true);
//       socket?.emit("typing", selectedChatIdRef.current);
//     }

//     const lastTypingTime = Date.now();
//     setTimeout(() => {
//       const timeNow = Date.now();
//       if (timeNow - lastTypingTime >= 3000 && typing) {
//         socket?.emit("stop typing", selectedChatIdRef.current);
//         setTyping(false);
//       }
//     }, 3000);
//   };

//   // === Listen for Incoming Messages (de-duped + ref check) ===
//   useEffect(() => {
//     if (!socket) return;

//     const handleMessageReceived = (newMessageReceived) => {
//       // normalize id (some backends send chatId or chat)
//       const incomingChatId =
//         newMessageReceived?.chat?._id ||
//         newMessageReceived?.chatId ||
//         newMessageReceived?.chat;

//       const currentChatId = selectedChatIdRef.current;

//       if (!currentChatId || currentChatId !== incomingChatId) {
//         if (!notification.find((n) => n._id === newMessageReceived._id)) {
//           setNotification([newMessageReceived, ...notification]);
//           setFetchAgain((prev) => !prev);
//         }
//         return;
//       }

//       // same chat => push to UI immediately
//       setMessages((prev) => [...prev, newMessageReceived]);
//     };

//     // avoid duplicate listeners
//     socket.off("message received", handleMessageReceived);
//     socket.on("message received", handleMessageReceived);

//     return () => {
//       socket.off("message received", handleMessageReceived);
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [notification, setNotification, setFetchAgain]);

//   return (
//     <>
//       {selectedChat ? (
//         <>
//           {/* === Chat Header === */}
//           <Text
//             fontSize={{ base: "28px", md: "30px" }}
//             pb={3}
//             px={2}
//             w="100%"
//             fontFamily="Work sans"
//             display="flex"
//             justifyContent="space-between"
//             alignItems="center"
//           >
//             {!selectedChat.isGroupChat ? (
//               <>
//                 {getSender(user, selectedChat.users)}
//                 <ProfileModal user={getSenderFull(user, selectedChat.users)} />
//               </>
//             ) : (
//               <>
//                 {selectedChat.chatName.toUpperCase()}
//                 <UpdateGroupChatModal
//                   fetchMessages={async () => {
//                     if (!selectedChat?._id) return;
//                     try {
//                       const config = {
//                         headers: { Authorization: `Bearer ${user.token}` },
//                       };
//                       const { data } = await axios.get(
//                         `${ENDPOINT}/api/message/${selectedChat._id}`,
//                         config
//                       );
//                       setMessages(data);
//                       socket?.emit("join chat", selectedChat._id);
//                     } catch (error) {
//                       toast({
//                         title: "Error Occurred!",
//                         description: "Failed to load messages",
//                         status: "error",
//                         duration: 5000,
//                         isClosable: true,
//                         position: "bottom",
//                       });
//                     }
//                   }}
//                   fetchAgain={fetchAgain}
//                   setFetchAgain={setFetchAgain}
//                 />
//               </>
//             )}
//           </Text>

//           {/* === Chat Box === */}
//           <Box
//             display="flex"
//             flexDir="column"
//             justifyContent="flex-end"
//             p={3}
//             bg="#E8E8E8"
//             w="100%"
//             h="100%"
//             borderRadius="lg"
//             overflowY="hidden"
//           >
//             {loading ? (
//               <Text>Loading...</Text>
//             ) : (
//               // force re-render on messages change or chat switch
//               <ScrollableChat
//                 key={`${selectedChat?._id}-${messages.length}`}
//                 messages={messages}
//               />
//             )}

//             {/* === AI Suggestions === */}
//             <Box bg="white" p={2} borderRadius="md" mt={2}>
//               <Button
//                 size="sm"
//                 colorScheme="blue"
//                 onClick={fetchAISuggestions}
//                 isLoading={loadingSuggestions}
//               >
//                 Get AI Suggestions
//               </Button>
//               {aiSuggestions.length > 0 && (
//                 <Box mt={2}>
//                   {aiSuggestions.map((s, i) => (
//                     <Button
//                       key={i}
//                       size="sm"
//                       m={1}
//                       variant="outline"
//                       onClick={() => setNewMessage(s)}
//                     >
//                       {s}
//                     </Button>
//                   ))}
//                 </Box>
//               )}
//             </Box>

//             {/* Typing Animation */}
//             {isTyping && (
//               <div>
//                 <Lottie
//                   options={defaultOptions}
//                   width={70}
//                   style={{ marginBottom: 15, marginLeft: 0 }}
//                 />
//               </div>
//             )}

//             {/* Input Box */}
//             <FormControl isRequired mt={3}>
//               <Input
//                 variant="filled"
//                 bg="#E0E0E0"
//                 placeholder="Enter a message..."
//                 value={newMessage}
//                 onChange={typingHandler}
//                 onKeyDown={sendMessage}
//               />
//             </FormControl>
//           </Box>
//         </>
//       ) : (
//         <Box
//           display="flex"
//           alignItems="center"
//           justifyContent="center"
//           h="100%"
//         >
//           <Text fontSize="3xl" pb={3} fontFamily="Work sans">
//             Click on a user to start chatting
//           </Text>
//         </Box>
//       )}
//     </>
//   );
// };

// export default SingleChat;


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

  // === AI Suggestions State ===
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

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

  // === AI Suggestion Function (Human + Short replies) ===
  const fetchAISuggestions = async () => {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY; // ✅ correct variable

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
        .map((m) => `${m.sender.name}: ${m.content}`)
        .join("\n");

      // 🔥 prompt ensures short, natural, friendly, and human-sounding replies
      const prompt = `
You are a real person chatting naturally in an online conversation, not an AI assistant. 
Your goal is to continue the chat in a way that feels completely human and authentic.

Read the conversation below and imagine you are responding to it as a friendly, normal person. 
Think about tone, flow, and natural phrasing — your replies should sound like how people actually talk in everyday messages.

Write exactly 3 possible replies a real person might send next.

Guidelines:
- Keep each reply short (under 12 words).
- Make them casual, simple, and natural — like real chat replies.
- Avoid sounding robotic, overly polite, or professional.
- Do not use emojis, quotes, markdown symbols, or numbering.
- Do not explain or describe the replies.
- Do not include phrases like “Option 1,” “Why it works,” or “Response:”.
- Just output the 3 replies, each on its own line.

Conversation:

${recentMessages}
`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8, // more natural, varied tone
            maxOutputTokens: 60, // control length (≈ short sentences)
          },
        }
      );

      const aiText =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Clean, short lines
      const suggestions = aiText
        .split("\n")
        .map((line) => line.replace(/^\s*[-*\d.]+\s*/, "").trim())
        .filter((line) => line && line.split(" ").length <= 20) // limit long ones
        .slice(0, 3); // keep top 3

      setAiSuggestions(suggestions);
    } catch (error) {
      console.error("AI Suggestion Error:", error.response || error);
      toast({
        title: "AI Error",
        description:
          "Failed to fetch AI suggestions. Please check your API key or network.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // === Setup Socket Connection ===
  useEffect(() => {
    if (!socket) {
      socket = io(ENDPOINT, { transports: ["websocket"] });
      socket.emit("setup", user);
      socket.on("connected", () => setSocketConnected(true));
      socket.on("typing", () => setIsTyping(true));
      socket.on("stop typing", () => setIsTyping(false));
    }
  }, [user]);

  // === Fetch Messages ===
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
        socket?.emit("join chat", selectedChat._id);
      } catch (error) {
        console.error("Error fetching messages:", error.response || error);
        toast({
          title: "Error Occurred!",
          description: "Failed to load messages",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "bottom",
        });
        setLoading(false);
      }
    };

    setMessages([]);
    fetchMessages();
  }, [selectedChat, user, toast]);

  // === Send Message ===
  const sendMessage = async (event) => {
    if (event.key === "Enter" && newMessage.trim() !== "") {
      if (!selectedChatIdRef.current) return;

      socket?.emit("stop typing", selectedChatIdRef.current);

      try {
        const config = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };
        const payload = {
          content: newMessage,
          chatId: selectedChatIdRef.current,
        };
        const { data } = await axios.post(
          `${ENDPOINT}/api/message`,
          payload,
          config
        );
        setNewMessage("");
        if (data?.chat?._id === selectedChatIdRef.current) {
          setMessages((prev) => [...prev, data]);
        }
        socket?.emit("new message", data);
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
    if (!socketConnected || !selectedChatIdRef.current) return;
    if (!typing) {
      setTyping(true);
      socket?.emit("typing", selectedChatIdRef.current);
    }
    const lastTypingTime = Date.now();
    setTimeout(() => {
      const timeNow = Date.now();
      if (timeNow - lastTypingTime >= 3000 && typing) {
        socket?.emit("stop typing", selectedChatIdRef.current);
        setTyping(false);
      }
    }, 3000);
  };

  // === Incoming Messages ===
  useEffect(() => {
    if (!socket) return;
    const handleMessageReceived = (newMessageReceived) => {
      const incomingChatId =
        newMessageReceived?.chat?._id ||
        newMessageReceived?.chatId ||
        newMessageReceived?.chat;
      const currentChatId = selectedChatIdRef.current;
      if (!currentChatId || currentChatId !== incomingChatId) {
        if (!notification.find((n) => n._id === newMessageReceived._id)) {
          setNotification([newMessageReceived, ...notification]);
          setFetchAgain((prev) => !prev);
        }
        return;
      }
      setMessages((prev) => [...prev, newMessageReceived]);
    };
    socket.off("message received", handleMessageReceived);
    socket.on("message received", handleMessageReceived);
    return () => {
      socket.off("message received", handleMessageReceived);
    };
  }, [notification, setNotification, setFetchAgain]);

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
                  fetchMessages={() => {}}
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
              <ScrollableChat
                key={`${selectedChat?._id}-${messages.length}`}
                messages={messages}
              />
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

            {isTyping && (
              <div>
                <Lottie
                  options={defaultOptions}
                  width={70}
                  style={{ marginBottom: 15, marginLeft: 0 }}
                />
              </div>
            )}

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
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          h="100%"
        >
          <Text fontSize="3xl" pb={3} fontFamily="Work sans">
            Click on a user to start chatting
          </Text>
        </Box>
      )}
    </>
  );
};

export default SingleChat;
