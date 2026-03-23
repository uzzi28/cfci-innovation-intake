from openai import OpenAI
from pydantic import BaseModel
from app.schemas import openai_schemas
import logging

logger = logging.getLogger(__name__)

"""
Service used primarily to interact with the OpenAI API
and OpenAI's various models.

Much more functionality to be added soon as needed,
along with Anthropic and Gemini services.
"""
class OpenAIService:
    def __init__(self, api_key: str):
        self.client = OpenAI(
        api_key=api_key,
        base_url="https://litellm.oit.duke.edu"
        )   

    def handle_message(self, system_prompt: str = "", user_prompt: str = "", response_format: type[BaseModel] = openai_schemas.DefaultLLMOutput):
        """
        Send a message to OpenAI and get a structured response.
        """
        try:
            response = self.client.responses.parse(
                model="GPT 4.1",
                input=[
                    {
                        "role": "system", 
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ],
                text_format=response_format
            )
            return { "input_message": user_prompt, "response": response.output_parsed }
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    def simple_chat(self, messages: list[dict], system_prompt: str = "") -> str:
        """
        Simple chat completion without structured output.
        Used for basic conversational responses.
        """
        try:
            all_messages = []
            if system_prompt:
                all_messages.append({"role": "system", "content": system_prompt})
            all_messages.extend(messages)
            
            response = self.client.chat.completions.create(
                model="GPT 4.1",
                messages=all_messages,
                temperature=0.7,
                max_tokens=1000
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI API error in simple_chat: {e}")
            raise

