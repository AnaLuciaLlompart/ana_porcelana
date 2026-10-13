from datetime import timedelta
from pathlib import Path
import os
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

load_dotenv(BASE_DIR / '.env')


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('SECRET_KEY')



# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'axes',
    'usuarios',
    'materiales',
    'categorias',
    'productos',
    'clientes',
    'pedidos',
    'gastos',
    'finanzas',
    'inicio',
    'catalogo',
]


MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # Va último: solo revisa, cuando la respuesta ya está armada, si el
    # login quedó bloqueado por intentos fallidos, y en ese caso la
    # reemplaza por la de bloqueo (respuesta_bloqueo, en usuarios/views.py).
    'axes.middleware.AxesMiddleware',
]

# authenticate() prueba los backends en este orden. El de axes va primero:
# si el usuario + IP están bloqueados, corta ahí y la contraseña ni se
# compara. Si no, sigue con el backend normal de Django.
AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',
    'django.contrib.auth.backends.ModelBackend',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT'),
    }
}


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'es-ar'

TIME_ZONE = 'America/Argentina/Tucuman'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'

# Archivos subidos (imágenes de materiales y productos)
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'



# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'



# REST Framework

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication', # indica que se utilizan sesiones con cookies para la autenticacion
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated', # es el fallar cerrado. IsAuthenticated significa que todo endpoint exige sesión activa salvo que diga explícitamente lo contrario
    ],
    'DEFAULT_THROTTLE_CLASSES': [ # activa el rate limiting
        'rest_framework.throttling.AnonRateThrottle', # cuenta pedidos de visitantes sin sesión, identificándolos por dirección IP.
        'rest_framework.throttling.UserRateThrottle', # cuenta los de usuarias autenticadas, identificándolas por su id.
    ],
    'DEFAULT_THROTTLE_RATES': { # son los numeros
        'anon': '30/minute', #anonimos: clientes para el catalogo
        'user': '200/minute', #usuarios: para el modulo de gestion
        'login': '5/minute', #5 intentos de login por minuto
        'catalogo': '60/minute', # el catálogo público: lo comparten las tres vistas de la app catalogo, por IP
    },
}





# Modelo de usuario propio (recomendación oficial de Django)
AUTH_USER_MODEL = 'usuarios.Usuario'



# Bloqueo del login por intentos fallidos (django-axes). El throttle
# 'login' de arriba frena la ráfaga (5 por minuto, en memoria); esto frena
# el goteo: los intentos se guardan en la base y persisten.
AXES_FAILURE_LIMIT = 5                      # al quinto fallo seguido se bloquea
AXES_COOLOFF_TIME = timedelta(minutes=30)   # cuánto dura el bloqueo
# Se bloquea la combinación usuario + IP: un atacante desde otra IP no
# puede dejar afuera a la usuaria, y ella no queda afuera por intentos
# ajenos. Bloquear solo por usuario, con una sola usuaria, sería bloquear
# el sistema entero.
AXES_LOCKOUT_PARAMETERS = [['username', 'ip_address']]
AXES_RESET_ON_SUCCESS = True                # un login correcto borra los fallos previos
# Respuesta cuando está bloqueado: JSON con 'detail' y 429, que es lo que
# la pantalla de login ya sabe mostrar. La de axes por defecto es HTML.
AXES_LOCKOUT_CALLABLE = 'usuarios.views.respuesta_bloqueo'



# Sesión: dura 24 horas desde la última acción, no desde el login.
# SESSION_SAVE_EVERY_REQUEST renueva el vencimiento en cada request
# (cuesta un UPDATE en django_session por request). El default de Django
# son 2 semanas fijas.
SESSION_COOKIE_AGE = 24 * 60 * 60
SESSION_SAVE_EVERY_REQUEST = True



# Entorno activo. Se lee del .env y determina qué configuración carga manage.py. Valores posibles: 'desarrollo' o 'produccion'.
ENTORNO = os.getenv('ENTORNO', 'desarrollo')