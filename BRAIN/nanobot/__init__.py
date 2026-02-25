"""
UNICHAN - A Local AI Agent Framework
"""
import sys

__version__ = "0.2.0"
# Use ASCII on Windows to avoid cp1252 UnicodeEncodeError with Rich/console
__logo__ = "<3" if sys.platform == "win32" else "💖"

# ASCII/Unicode art banner (UNICHAN logo) — printed on onboard and gateway
# Content matches ascii-unichan in repo root
__ascii_banner__ = """

 ⣿⠊⢰⢇⢙⠊⣼⣶⣾⣭⣍⡉⠽⢿⠿⠶⣶⣮⠍⠎⢿⣿⣿⣿⣦⠹
⠿⢾⣪⣮⢀⣾⣿⣿⣿⣿⣿⣿⣷⣶⣶⣄⠛⠿⢶⣷⡈⣿⣿⣿⣿⠐
⣷⣴⡬⢡⣾⣿⣿⣿⣿⣿⣿⣿⣿⣟⣛⣛⣛⣓⠂⢲⠄⣿⣿⣿⣿⣆
⡙⠛⢠⣿⣿⡿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣦⢸⣿⣿⠙⣿
⣿⢁⣿⠟⣡⣶⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⣟⡻⢿⣿⢸⣿⣿⠄⣿
⡏⡼⢫⣼⣿⣿⣿⢿⣿⣿⣿⣿⣿⣿⣿⣞⣭⣤⣤⣤⣬⠸⣿⣿⠄⣿
⠃⣷⣿⣿⡟⠵⠊⣑⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⣿⣿⠄⣿
⠄⠘⣿⣿⠁⣴⣾⣿⣿⣿⣿⣿⢹⣿⣿⣿⣿⣿⣿⣿⣿⡇⣿⣿⢠⣿
⠄⠰⣆⠹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⢋⣿⣿⣿⣿⡿⠇⡿⡁⣸⣿
⡀⣀⠙⠳⡘⢿⣿⣿⣿⣿⣿⣤⣥⣿⣶⣿⣿⣿⣿⡿⢃⠄⣓⢁⣿⣯
⣷⡈⠆⠄⠠⠈⡻⢿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠟⠉⡀⢍⠁⢁⣼⣿⢋
⢿⣿⣦⢵⠐⡩⠁⡄⡌⡉⠟⣿⣻⣟⣋⣥⣶⡀⡁⡃⠪⣠⣼⣿⣟⣼
░█░█░█▀█░▀█▀░░░█░█░▀█░░░░░▄▀▄
░█░█░█░█░░█░░░░▀▄▀░░█░░░░░█/█
░▀▀▀░▀░▀░▀▀▀░░░░▀░░▀▀▀░▀░░░▀░
"""
